from app.utils.memory import free_memory
import asyncio
import base64
import io
import json
import logging
import secrets
from pathlib import Path
from typing import List, Optional
from fastapi import APIRouter, UploadFile, File, Form, HTTPException, Query, BackgroundTasks, Response
from fastapi.responses import FileResponse, JSONResponse
import pymupdf
from PIL import Image

# Enforce image decompression limits
Image.MAX_IMAGE_PIXELS = 50_000_000

from app.core.config import settings
from app.core.security import sanitize_filename, sniff_file_type, validate_job_id
from app.jobs.models import Job, JobStatus, ToolCategory, PreviewResponse, FileInfo
from app.jobs.manager import job_manager
from app.jobs.executor import execute_job
from app.services.tool_registry import list_tools, get_tool
from app.utils.file_utils import get_job_dir, validate_zip_bomb

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
def get_tools(response: Response, category: Optional[ToolCategory] = None, q: Optional[str] = None):
    """Retrieve catalog of available PDF tools."""
    response.headers["Cache-Control"] = "public, max-age=120"
    tools = list_tools(category)
    if q and q.strip():
        query = q.lower().strip()
        tools = [
            t for t in tools
            if query in t.name.lower() or query in t.description.lower() or query in t.tagline.lower() or query in t.id.lower()
        ]
    return tools


@router.get("/tools/{tool_id}")
def get_tool_by_id(tool_id: str, response: Response):
    """Retrieve specific tool definition."""
    t = get_tool(tool_id)
    if not t:
        raise HTTPException(status_code=404, detail=f"Tool '{tool_id}' not found")
    response.headers["Cache-Control"] = "public, max-age=120"
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

    # Validate file extension against tool.accepts whitelist
    accepted_exts = [a.lower() for a in tool.accepts]
    for uploaded_file in files:
        fname = uploaded_file.filename or ""
        ext = Path(fname).suffix.lower()
        if accepted_exts and ext not in accepted_exts:
            raise HTTPException(
                status_code=400,
                detail=f"File '{fname}' format ({ext or 'none'}) is not accepted by tool '{tool.name}'. Accepted: {', '.join(tool.accepts)}"
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
        dest_path = (job_dir / stored_id).resolve()
        if not dest_path.is_relative_to(job_dir.resolve()) or dest_path == job_dir.resolve():
            job_manager.delete_job(job.id)
            raise HTTPException(status_code=400, detail="Path traversal attempt in filename")

        # Stream save and enforce max file size limit
        bytes_written = 0
        with open(dest_path, "wb") as f_out:
            while chunk := await uploaded_file.read(256 * 1024):  # 256KB chunks
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

        ext = dest_path.suffix.lower()
        if ext == ".pdf" and sniffed_type != "pdf":
            job_manager.delete_job(job.id)
            raise HTTPException(
                status_code=400,
                detail=f"Uploaded file '{safe_name}' is not a valid PDF document (magic bytes mismatch)."
            )
        elif ext == ".png" and sniffed_type != "png":
            job_manager.delete_job(job.id)
            raise HTTPException(
                status_code=400,
                detail=f"Uploaded file '{safe_name}' is not a valid PNG image (magic bytes mismatch)."
            )
        elif ext in (".jpg", ".jpeg") and sniffed_type not in ("jpg", "jpeg"):
            job_manager.delete_job(job.id)
            raise HTTPException(
                status_code=400,
                detail=f"Uploaded file '{safe_name}' is not a valid JPEG image (magic bytes mismatch)."
            )
        elif ext == ".webp" and sniffed_type != "webp":
            job_manager.delete_job(job.id)
            raise HTTPException(
                status_code=400,
                detail=f"Uploaded file '{safe_name}' is not a valid WebP image (magic bytes mismatch)."
            )
        elif ext in (".tif", ".tiff") and sniffed_type != "tiff":
            job_manager.delete_job(job.id)
            raise HTTPException(
                status_code=400,
                detail=f"Uploaded file '{safe_name}' is not a valid TIFF image (magic bytes mismatch)."
            )
        elif ext in (".docx", ".xlsx", ".pptx") and sniffed_type != "zip_office":
            job_manager.delete_job(job.id)
            raise HTTPException(
                status_code=400,
                detail=f"Uploaded file '{safe_name}' is not a valid Office document (magic bytes mismatch)."
            )

        # Check for decompression bombs in office files
        if dest_path.suffix.lower() in (".docx", ".xlsx", ".pptx", ".zip"):
            try:
                validate_zip_bomb(dest_path)
            except ValueError as bomb_err:
                job_manager.delete_job(job.id)
                raise HTTPException(status_code=400, detail=str(bomb_err))

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
    try:
        validate_job_id(job_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid job ID format")

    job = job_manager.get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found or has expired")
    return job


@router.post("/jobs/{job_id}/cancel")
def cancel_job(job_id: str):
    """Cancel a pending or running job."""
    try:
        validate_job_id(job_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid job ID format")

    success = job_manager.cancel_job(job_id)
    if not success:
        raise HTTPException(status_code=400, detail="Cannot cancel completed, failed, or non-existent job")
    return {"success": True, "message": "Job cancelled"}


@router.delete("/jobs/{job_id}")
def delete_job(job_id: str):
    """Manually purge temporary job files immediately."""
    try:
        validate_job_id(job_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid job ID format")

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
    try:
        validate_job_id(job_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid job ID format")

    job = job_manager.get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found or expired")

    # Verify authorization download token with constant-time comparison
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
            raise HTTPException(status_code=404, detail="Requested file not found in job outputs")
    else:
        target_out = job.output_files[0]

    job_dir = get_job_dir(job_id, create=False)
    if not job_dir.exists():
        raise HTTPException(status_code=404, detail="Job directory not found")

    file_path = (job_dir / target_out.file_id).resolve()

    # Defend against path traversal and symlinks
    if not file_path.is_relative_to(job_dir.resolve()) or not file_path.is_file() or file_path.is_symlink():
        raise HTTPException(status_code=400, detail="Invalid file path")

    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Generated output file is missing")

    safe_dl_name = sanitize_filename(target_out.filename)

    # Safe headers discouraging arbitrary script execution and MIME sniffing
    headers = {
        "Content-Disposition": f'attachment; filename="{safe_dl_name}"',
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": "default-src 'none'; sandbox",
        "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0"
    }

    return FileResponse(
        path=str(file_path),
        filename=safe_dl_name,
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
    if not (file.filename or "").lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Preview only available for PDF documents")

    # Bound dimension and page index parameters to prevent resource exhaustion
    safe_max_dim = max(100, min(1200, max_dim))
    safe_page_index = max(0, page_index)

    # Stream-read file with strict size enforcement
    buffer = bytearray()
    while chunk := await file.read(256 * 1024):
        buffer.extend(chunk)
        if len(buffer) > settings.max_upload_bytes:
            raise HTTPException(status_code=413, detail="File too large for preview")

    content = bytes(buffer)
    if not content.startswith(b"%PDF-"):
        raise HTTPException(status_code=400, detail="Invalid PDF file format (missing PDF magic bytes)")

    try:
        doc = pymupdf.open(stream=content, filetype="pdf")
        total_pages = len(doc)
        if total_pages == 0:
            doc.close()
            raise HTTPException(status_code=400, detail="PDF has 0 pages")

        idx = max(0, min(total_pages - 1, safe_page_index))
        page = doc[idx]

        # Calculate scale to fit within safe_max_dim
        rect = page.rect
        scale = min(safe_max_dim / max(1, rect.width), safe_max_dim / max(1, rect.height))
        mat = pymupdf.Matrix(scale, scale)

        pix = page.get_pixmap(matrix=mat, alpha=False)
        w_px, h_px = pix.width, pix.height
        jpeg_bytes = pix.tobytes("jpeg", jpg_quality=65)
        img_b64 = base64.b64encode(jpeg_bytes).decode("utf-8")
        pix = None

        text_snippet = page.get_text("text")[:300].strip()

        # Extract structured text spans with bounding boxes for visual editing (bounded to 500)
        spans_data = []
        try:
            td = page.get_text("dict")
            for block in td.get("blocks", []):
                if len(spans_data) >= 500:
                    break
                for line in block.get("lines", []):
                    if len(spans_data) >= 500:
                        break
                    for span in line.get("spans", []):
                        if len(spans_data) >= 500:
                            break
                        txt = span.get("text", "").strip()
                        if txt:
                            c = span.get("color", 0)
                            color_hex = f"#{c:06x}" if isinstance(c, int) else "#111827"
                            spans_data.append({
                                "text": txt,
                                "bbox": [round(float(x), 2) for x in span.get("bbox", [0, 0, 0, 0])],
                                "size": round(float(span.get("size", 12.0)), 1),
                                "font": span.get("font", "Helvetica"),
                                "color": color_hex
                            })
        except Exception:
            spans_data = []

        doc.close()
        del content
        free_memory()

        return PreviewResponse(
            total_pages=total_pages,
            current_page=idx + 1,
            image_base64=f"data:image/jpeg;base64,{img_b64}",
            width=w_px,
            height=h_px,
            text_content=text_snippet,
            page_width_pt=round(float(rect.width), 2),
            page_height_pt=round(float(rect.height), 2),
            text_spans=spans_data
        )
    except HTTPException:
        raise
    except Exception as exc:
        logger.warning("Preview generation failed: %s", exc)
        raise HTTPException(status_code=400, detail=f"Could not render preview: {str(exc)}")


@router.post("/pdf-info")
async def get_pdf_info(file: UploadFile = File(...)):
    """Fast, zero-render document metadata inspector."""
    if not (file.filename or "").lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are supported")

    # Stream-read file with strict size enforcement
    buffer = bytearray()
    while chunk := await file.read(256 * 1024):
        buffer.extend(chunk)
        if len(buffer) > settings.max_upload_bytes:
            raise HTTPException(status_code=413, detail="File too large for inspection")

    content = bytes(buffer)
    if not content.startswith(b"%PDF-"):
        raise HTTPException(status_code=400, detail="Invalid PDF file format (missing PDF magic bytes)")

    try:
        doc = pymupdf.open(stream=content, filetype="pdf")
        total = len(doc)
        is_enc = doc.is_encrypted
        doc.close()
        del content
        free_memory()
        return {"total_pages": total, "is_encrypted": is_enc}
    except Exception as exc:
        free_memory()
        raise HTTPException(status_code=400, detail=f"Could not read PDF: {str(exc)}")


@router.post("/ai/suggest-questions")
async def api_suggest_questions(file: UploadFile = File(...)):
    """Fast semantic suggestion generator for uploaded PDFs."""
    if not (file.filename or "").lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are supported")

    buffer = bytearray()
    while chunk := await file.read(256 * 1024):
        buffer.extend(chunk)
        if len(buffer) > settings.max_upload_bytes:
            raise HTTPException(status_code=413, detail="File too large")

    content = bytes(buffer)
    if not content.startswith(b"%PDF-"):
        raise HTTPException(status_code=400, detail="Invalid PDF format")

    try:
        doc = pymupdf.open(stream=content, filetype="pdf")
        pages_data = []
        for i in range(min(15, len(doc))):
            text = doc[i].get_text("text").strip()
            headings = []
            for line in text.splitlines():
                line_str = line.strip()
                if 4 <= len(line_str) <= 70 and not line_str.endswith("."):
                    if line_str.isupper() or line_str.istitle():
                        headings.append(line_str)
            pages_data.append({
                "page": i + 1,
                "text": text[:10000],
                "headings": headings[:6]
            })
        doc.close()
        del content
        free_memory()

        from app.services.ai.ai_service import generate_suggested_questions
        questions = generate_suggested_questions(pages_data, count=5)
        return {"suggested_questions": questions}
    except Exception as exc:
        free_memory()
        logger.warning("Error generating suggested questions: %s", exc)
        return {"suggested_questions": [
            "What is the executive summary and main objective of this document?",
            "What are the critical dates, deadlines, or milestones mentioned?",
            "What are the primary recommendations, action items, or next steps?"
        ]}
