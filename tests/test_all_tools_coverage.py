import tempfile
from pathlib import Path
import pymupdf
import docx
import openpyxl
import pptx
from PIL import Image

from app.services.tool_registry import ALL_TOOLS
from app.jobs.manager import job_manager
from app.jobs.executor import execute_job
from app.jobs.models import FileInfo

def test_all_65_tools_execution():
    with tempfile.TemporaryDirectory() as temp_dir:
        td = Path(temp_dir)
        pdf1 = td / "doc1.pdf"
        pdf2 = td / "doc2.pdf"

        # Create 2-page sample PDFs
        doc1 = pymupdf.open()
        p1 = doc1.new_page(width=612, height=792)
        p1.insert_text((72, 100), "First test PDF document - Page 1", fontsize=16)
        p1.insert_text((72, 150), "Keywords: invoice, payment, date.", fontsize=12)
        p2 = doc1.new_page(width=612, height=792)
        p2.insert_text((72, 100), "First test PDF document - Page 2", fontsize=16)
        doc1.save(str(pdf1))
        doc1.close()

        doc2 = pymupdf.open()
        p = doc2.new_page(width=612, height=792)
        p.insert_text((72, 100), "Second test PDF document", fontsize=16)
        doc2.save(str(pdf2))
        doc2.close()

        img_png = td / "test.png"
        img_jpg = td / "test.jpg"
        img_webp = td / "test.webp"
        img_tiff = td / "test.tiff"
        Image.new("RGB", (100, 100), color=(73, 109, 137)).save(str(img_png), format="PNG")
        Image.new("RGB", (100, 100), color=(73, 109, 137)).save(str(img_jpg), format="JPEG")
        Image.new("RGB", (100, 100), color=(73, 109, 137)).save(str(img_webp), format="WEBP")
        Image.new("RGB", (100, 100), color=(73, 109, 137)).save(str(img_tiff), format="TIFF")

        doc_docx = td / "test.docx"
        d = docx.Document()
        d.add_paragraph("Test text")
        d.save(str(doc_docx))

        doc_xlsx = td / "test.xlsx"
        wb = openpyxl.Workbook()
        wb.active.append(["A", "B", 10])
        wb.save(str(doc_xlsx))

        doc_pptx = td / "test.pptx"
        prs = pptx.Presentation()
        prs.slides.add_slide(prs.slide_layouts[0])
        prs.save(str(doc_pptx))

        txt_file = td / "test.txt"
        txt_file.write_text("Sample plain text content.", encoding="utf-8")

        md_file = td / "test.md"
        md_file.write_text("# Markdown Heading\n\nSample markdown.", encoding="utf-8")

        html_file = td / "test.html"
        html_file.write_text("<html><body><h1>HTML Test</h1></body></html>", encoding="utf-8")

        for tool in ALL_TOOLS:
            tool_id = tool.id
            opts = {}
            if tool_id == "split-pdf":
                opts = {"mode": "ranges", "ranges": "1"}
            elif tool_id == "rotate-pdf":
                opts = {"angle": 90}
            elif tool_id == "protect-pdf":
                opts = {"password": "testpwd"}
            elif tool_id == "unlock-pdf":
                from app.services.security import security_service
                prot_pdf = td / "prot.pdf"
                security_service.protect_pdf(pdf1, prot_pdf, "testpwd")
                opts = {"password": "testpwd"}
            elif tool_id == "remove-pages":
                opts = {"pages_to_remove": "1"}
            elif tool_id == "extract-pages":
                opts = {"pages": "1"}
            elif tool_id == "crop-pdf":
                opts = {"top": 10, "bottom": 10, "left": 10, "right": 10}
            elif tool_id == "add-page-numbers":
                opts = {"position": "bottom_center", "format": "Page {n} of {total}"}
            elif tool_id == "add-watermark":
                opts = {"text": "DRAFT", "opacity": 0.3, "rotation": 45}
            elif tool_id == "redact-pdf":
                opts = {"keywords": ["invoice"]}
            elif tool_id == "ask-pdf":
                opts = {"question": "What is in this document?"}
            elif tool_id == "translate-pdf":
                opts = {"language": "es"}
            elif tool_id == "add-text":
                opts = {"text": "Added Text", "x": 100, "y": 200}
            elif tool_id == "highlight-text":
                opts = {"query": "invoice", "color": "#fde047"}
            elif tool_id == "underline-strikethrough":
                opts = {"query": "invoice", "action": "underline"}
            elif tool_id == "draw-freehand":
                opts = {"points": [[100, 100], [150, 150]], "color": "#111827"}
            elif tool_id == "add-shapes":
                opts = {"shapes": [{"type": "rect", "x": 50, "y": 50, "w": 100, "h": 50, "stroke_color": "#2563eb"}]}
            elif tool_id == "add-comments":
                opts = {"comment": "Check this section"}
            elif tool_id == "add-stamp":
                opts = {"stamp_text": "APPROVED", "color": "#16a34a"}
            elif tool_id == "add-header-footer":
                opts = {"header_center": "Header Text", "footer_center": "Footer Text"}
            elif tool_id == "crop-margins":
                opts = {"margin": 20}
            elif tool_id == "compress-pdf":
                opts = {"preset": "recommended"}

            if tool_id == "merge-pdf":
                test_files = [pdf1, pdf2]
            elif tool_id == "compare-pdfs":
                test_files = [pdf1, pdf2]
            elif tool_id == "unlock-pdf":
                test_files = [td / "prot.pdf"]
            elif tool_id == "word-to-pdf":
                test_files = [doc_docx]
            elif tool_id == "excel-to-pdf":
                test_files = [doc_xlsx]
            elif tool_id == "powerpoint-to-pdf":
                test_files = [doc_pptx]
            elif tool_id == "jpg-to-pdf":
                test_files = [img_jpg]
            elif tool_id == "png-to-pdf":
                test_files = [img_png]
            elif tool_id == "webp-to-pdf":
                test_files = [img_webp]
            elif tool_id == "tiff-to-pdf":
                test_files = [img_tiff]
            elif tool_id == "images-to-pdf":
                test_files = [img_png, img_jpg]
            elif tool_id == "scan-to-pdf":
                test_files = [img_jpg]
            elif tool_id == "txt-to-pdf":
                test_files = [txt_file]
            elif tool_id == "markdown-to-pdf":
                test_files = [md_file]
            elif tool_id == "html-to-pdf":
                test_files = [html_file]
            elif tool_id == "add-image":
                test_files = [pdf1, img_png]
            else:
                test_files = [pdf1]

            job = job_manager.create_job(tool_id=tool_id, options=opts)
            job_dir = Path(job_manager._save_job_to_disk.__globals__["get_job_dir"](job.id))
            staged_files = []
            for f_idx, tf in enumerate(test_files):
                dest = job_dir / f"f_{f_idx}_{tf.name}"
                import shutil
                shutil.copy2(str(tf), str(dest))
                staged_files.append(FileInfo(
                    file_id=dest.name,
                    original_name=tf.name,
                    size_bytes=dest.stat().st_size,
                    content_type="application/octet-stream",
                    page_count=2 if tf.suffix == ".pdf" else None
                ))
            job.input_files = staged_files
            job_manager.update_job(job.id)

            import asyncio
            try:
                asyncio.run(execute_job(job.id))
                updated = job_manager.get_job(job.id)
                assert updated is not None, f"Job {job.id} disappeared for {tool_id}"
                assert updated.status == "completed", f"Tool {tool_id} failed with error: {updated.error}"
                assert len(updated.output_files) > 0, f"Tool {tool_id} produced 0 output files"
            finally:
                job_manager.delete_job(job.id)
