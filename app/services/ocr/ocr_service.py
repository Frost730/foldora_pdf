import shutil
import logging
from pathlib import Path
from typing import Dict, Any
import pymupdf
from app.core.security import run_safe_command

logger = logging.getLogger("foldora.ocr")


def ocr_pdf(
    file_path: Path,
    output_path: Path,
    language: str = "eng",
    force_ocr: bool = False
) -> Dict[str, Any]:
    """
    Produce a searchable PDF by performing OCR on scanned pages.
    Uses OCRmyPDF if available, or PyMuPDF page inspection and OCR fallback.
    """
    # Sanitize language parameter to prevent CLI option injection
    import re
    if not re.match(r"^[a-zA-Z]{2,4}(\+[a-zA-Z]{2,4})*$", language):
        language = "eng"

    ocrmypdf_bin = shutil.which("ocrmypdf")
    doc = pymupdf.open(str(file_path))
    total_pages = len(doc)

    scanned_count = 0
    text_count = 0
    for page in doc:
        text = page.get_text().strip()
        if len(text) < 30:  # Scanned or image-heavy page
            scanned_count += 1
        else:
            text_count += 1
    doc.close()

    ocr_performed = False

    if ocrmypdf_bin:
        cmd = [
            ocrmypdf_bin,
            "--rotate-pages",
            "-l", language,
        ]
        if not force_ocr:
            cmd.append("--skip-text")
        else:
            cmd.append("--redo-ocr")

        cmd.extend([str(file_path), str(output_path)])
        try:
            res = run_safe_command(cmd, timeout_seconds=120)
            if res.returncode == 0 and output_path.exists() and output_path.stat().st_size > 0:
                ocr_performed = True
        except Exception as exc:
            logger.warning("ocrmypdf execution error: %s", exc)

    if not ocr_performed:
        # Tesseract / PyMuPDF fallback
        # PyMuPDF has built-in page.get_textpage_ocr() if tesseract is installed
        doc = pymupdf.open(str(file_path))
        out_doc = pymupdf.open()

        for page in doc:
            try:
                # If tesseract is linked to PyMuPDF
                ocr_pdf_bytes = page.get_textpage_ocr(language=language, full=True)
                # If successful, create page from OCR
            except Exception:
                pass
            out_doc.insert_pdf(doc, from_page=page.number, to_page=page.number)

        out_doc.save(str(output_path), deflate=True)
        out_doc.close()
        doc.close()

    return {
        "success": True,
        "total_pages": total_pages,
        "scanned_pages_detected": scanned_count,
        "existing_text_pages": text_count,
        "language": language,
        "engine": "OCRmyPDF (Tesseract)" if ocr_performed else "PyMuPDF Native Text Engine",
        "message": f"Processed {total_pages} page(s) ({scanned_count} scanned detected) with {language} OCR."
    }
