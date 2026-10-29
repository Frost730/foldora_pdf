import asyncio
import base64
import io
import json
import logging
import secrets
from pathlib import Path
from typing import List, Optional
from fastapi import APIRouter, UploadFile, File, Form, HTTPException, Query, BackgroundTasks
from fastapi.responses import FileResponse, JSONResponse
import pymupdf
from PIL import Image

from app.core.config import settings
from app.core.security import sanitize_filename, sniff_file_type
from app.jobs.models import Job, JobStatus, ToolCategory, PreviewResponse, FileInfo
from app.jobs.manager import job_manager
from app.jobs.executor import execute_job
from app.services.tool_registry import list_tools, get_tool
from app.utils.file_utils import get_job_dir

logger = logging.getLogger("foldora.api")
router = APIRouter()


@router.get("/health")
def api_health():
    """Detailed API health metrics."""
    return {
        "status": "healthy",
        "app": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "max_upload_mb": settings.MAX_UPLOAD_MB,
        "max_concurrent_jobs": settings.MAX_CONCURRENT_JOBS,
        "ai_provider_configured": bool(settings.AI_PROVIDER and settings.AI_API_KEY)
    }


@router.get("/tools")
def get_tools(category: Optional[ToolCategory] = None, q: Optional[str] = None):
    """Retrieve catalog of available PDF tools."""
    tools = list_tools(category)
    if q and q.strip():
        query = q.lower().strip()
        tools = [
            t for t in tools
            if query in t.name.lower() or query in t.description.lower() or query in t.tagline.lower() or query in t.id.lower()
        ]
    return tools


@router.get("/tools/{tool_id}")
def get_tool_by_id(tool_id: str):
    """Retrieve specific tool definition."""
    t = get_tool(tool_id)
    if not t:
        raise HTTPException(status_code=404, detail=f"Tool '{tool_id}' not found")
    return t


@router.post("/jobs")
async def create_job(
    background_tasks: BackgroundTasks,
    tool_id: str = Form(...),
    options: str = Form(default="{}"),
    files: List[UploadFile] = File(...)
):
    """
    Create a temporary processing job, validate uploads, and launch the background worker.
    """
    tool = get_tool(tool_id)
    if not tool:
        raise HTTPException(status_code=404, detail=f"Invalid tool '{tool_id}'")

    if not files:
        raise HTTPException(status_code=400, detail="No files uploaded")

    if len(files) > tool.max_files:
        raise HTTPException(
            status_code=400,
            detail=f"Tool '{tool.name}' accepts at most {tool.max_files} file(s), received {len(files)}"
        )

    try:
        parsed_options = json.loads(options) if options else {}
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON in options field")

    # Create job in registry
    job = job_manager.create_job(tool_id=tool_id, options=parsed_options)
    job_dir = get_job_dir(job.id)

    # Save uploaded files into job directory securely
    saved_files = []
    total_bytes = 0

    for idx, uploaded_file in enumerate(files):
        safe_name = sanitize_filename(uploaded_file.filename or f"upload_{idx}.bin")
        stored_id = f"f_{idx}_{secrets.token_hex(4)}_{safe_name}"
        dest_path = job_dir / stored_id

        # Stream save and enforce max file size limit
        bytes_written = 0
        with open(dest_path, "wb") as f_out:
            while chunk := await uploaded_file.read(1024 * 1024):  # 1MB chunks
                bytes_written += len(chunk)
                total_bytes += len(chunk)
                if total_bytes > settings.max_upload_bytes:
                    job_manager.delete_job(job.id)
                    raise HTTPException(
                        status_code=413,
                        detail=f"Upload exceeded maximum total size limit of {settings.MAX_UPLOAD_MB} MB"
                    )
                f_out.write(chunk)

        # Inspect file type magic bytes
        sniffed_type = sniff_file_type(dest_path)
        logger.debug("File %s sniffed as %s", safe_name, sniffed_type)

        page_count = None
        if sniffed_type == "pdf" or dest_path.suffix.lower() == ".pdf":
            try:
                doc = pymupdf.open(str(dest_path))
                page_count = len(doc)
                if page_count > settings.MAX_PAGES_PER_JOB:
                    doc.close()
                    job_manager.delete_job(job.id)
                    raise HTTPException(
                        status_code=400,
                        detail=f"Document exceeds maximum page limit of {settings.MAX_PAGES_PER_JOB} pages (found {page_count})"
                    )
                doc.close()
            except HTTPException:
                raise
            except Exception:
                pass

        saved_files.append(FileInfo(
            file_id=stored_id,
            original_name=safe_name,
            size_bytes=bytes_written,
            content_type=uploaded_file.content_type or "application/octet-stream",
            page_count=page_count
        ))

    # Attach file info to job
    job.input_files = saved_files
    job_manager.update_job(job.id, message=f"Uploaded {len(saved_files)} file(s). Queued.")

    # Schedule background execution
    background_tasks.add_task(execute_job, job.id)

    return {
        "job_id": job.id,
        "status": job.status,
        "tool_id": job.tool_id,
        "files_count": len(saved_files),
        "download_token": job.download_token
    }


@router.get("/jobs/{job_id}")
def get_job_status(job_id: str):
    """Retrieve live processing status and output results for a job."""
    job = job_manager.get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found or has expired")
    return job


@router.post("/jobs/{job_id}/cancel")
def cancel_job(job_id: str):
    """Cancel a pending or running job."""
    success = job_manager.cancel_job(job_id)
    if not success:
        raise HTTPException(status_code=400, detail="Cannot cancel completed, failed, or non-existent job")
    return {"success": True, "message": "Job cancelled"}


@router.delete("/jobs/{job_id}")
def delete_job(job_id: str):
    """Manually purge temporary job files immediately."""
    deleted = job_manager.delete_job(job_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Job not found")
    return {"success": True, "message": "Temporary files wiped"}


@router.get("/jobs/{job_id}/download")
def download_job_file(
    job_id: str,
    token: str = Query(...),
    file_id: Optional[str] = Query(None)
):
    """Securely download the output generated by a job."""
    job = job_manager.get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found or expired")

    # Verify authorization download token
    if not secrets.compare_digest(job.download_token, token):
        raise HTTPException(status_code=403, detail="Invalid or unauthorized download token")

    if job.status != JobStatus.COMPLETED:
        raise HTTPException(status_code=400, detail=f"Job is not completed yet (current status: {job.status})")

    if not job.output_files:
        raise HTTPException(status_code=404, detail="No output files available for this job")

    # Select target file
    target_out = None
    if file_id:
        for out_f in job.output_files:
            if out_f.file_id == file_id or out_f.filename == file_id:
                target_out = out_f
                break
    if not target_out:
        target_out = job.output_files[0]

    job_dir = get_job_dir(job_id)
    file_path = job_dir / target_out.file_id

    # Defend against path traversal
    if not file_path.resolve().is_relative_to(job_dir.resolve()):
        raise HTTPException(status_code=400, detail="Invalid file path")

    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Generated output file is missing")

    # Safe headers discouraging arbitrary script execution
    headers = {
        "Content-Disposition": f'attachment; filename="{target_out.filename}"',
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0"
    }

    return FileResponse(
        path=str(file_path),
        filename=target_out.filename,
        media_type=target_out.content_type,
        headers=headers
    )


@router.post("/previews", response_model=PreviewResponse)
async def generate_preview(
    file: UploadFile = File(...),
    page_index: int = Form(default=0),
    max_dim: int = Form(default=600)
):
    """
    Generate an on-demand base64 thumbnail of a PDF page for client-side preview.
    Does not persist the file permanently.
    """
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Preview only available for PDF documents")

    content = await file.read()
    if len(content) > settings.max_upload_bytes:
        raise HTTPException(status_code=413, detail="File too large for preview")

    try:
        doc = pymupdf.open(stream=content, filetype="pdf")
        total_pages = len(doc)
        if total_pages == 0:
            doc.close()
            raise HTTPException(status_code=400, detail="PDF has 0 pages")

        idx = max(0, min(total_pages - 1, page_index))
        page = doc[idx]

        # Calculate scale to fit within max_dim
        rect = page.rect
        scale = min(max_dim / max(1, rect.width), max_dim / max(1, rect.height))
        mat = pymupdf.Matrix(scale, scale)

        pix = page.get_pixmap(matrix=mat, alpha=False)
        img = Image.frombytes("RGB", [pix.width, pix.height], pix.samples)

        buf = io.BytesIO()
        img.save(buf, format="JPEG", quality=80)
        img_b64 = base64.b64encode(buf.getvalue()).decode("utf-8")

        text_snippet = page.get_text("text")[:300].strip()
        doc.close()

        return PreviewResponse(
            total_pages=total_pages,
            current_page=idx + 1,
            image_base64=f"data:image/jpeg;base64,{img_b64}",
            width=pix.width,
            height=pix.height,
            text_content=text_snippet
        )
    except HTTPException:
        raise
    except Exception as exc:
        logger.warning("Preview generation failed: %s", exc)
        raise HTTPException(status_code=400, detail=f"Could not render preview: {str(exc)}")
