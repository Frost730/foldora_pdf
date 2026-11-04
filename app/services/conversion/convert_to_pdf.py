import io
import re
import shutil
import tempfile
import logging
from pathlib import Path
from typing import List, Optional
from PIL import Image, ImageEnhance, ImageOps
import pymupdf
from reportlab.lib.pagesizes import letter, A4, landscape
from reportlab.pdfgen import canvas
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib import colors
import html as html_module
from app.core.security import run_safe_command, sanitize_html_content, is_safe_url
from app.utils.file_utils import validate_zip_bomb

logger = logging.getLogger("foldora.conversion.to_pdf")


def images_to_pdf(
    image_paths: List[Path],
    output_path: Path,
    orientation: str = "auto",  # "auto", "portrait", "landscape"
    margin_pt: float = 18.0,
    fit_to_page: bool = True
) -> Path:
    """Convert one or multiple images (JPG, PNG, WebP, TIFF) into a unified PDF."""
    if not image_paths:
        raise ValueError("At least one image is required")

    doc = pymupdf.open()

    for img_path in image_paths:
        try:
            with Image.open(img_path) as pil_img:
                # Handle orientation from EXIF
                pil_img = ImageOps.exif_transpose(pil_img)
                w_px, h_px = pil_img.size
        except Image.DecompressionBombError as d_err:
            doc.close()
            raise ValueError(f"Image decompression bomb detected in '{img_path.name}': {d_err}")
        except Exception as e:
            doc.close()
            raise ValueError(f"Failed to open image '{img_path.name}': {e}")

        # Determine page size in points (72 pt per inch)
        if orientation == "portrait":
            page_w, page_h = 595.0, 842.0  # A4
        elif orientation == "landscape":
            page_w, page_h = 842.0, 595.0
        else:  # auto
            if w_px > h_px:
                page_w, page_h = 842.0, 595.0
            else:
                page_w, page_h = 595.0, 842.0

        # Calculate fitted rect
        avail_w = page_w - (2 * margin_pt)
        avail_h = page_h - (2 * margin_pt)

        img_aspect = w_px / max(1, h_px)
        avail_aspect = avail_w / max(1, avail_h)

        if fit_to_page:
            if img_aspect > avail_aspect:
                draw_w = avail_w
                draw_h = avail_w / img_aspect
            else:
                draw_h = avail_h
                draw_w = avail_h * img_aspect
        else:
            draw_w = min(avail_w, float(w_px))
            draw_h = min(avail_h, float(h_px))

        x0 = margin_pt + (avail_w - draw_w) / 2
        y0 = margin_pt + (avail_h - draw_h) / 2
        rect = pymupdf.Rect(x0, y0, x0 + draw_w, y0 + draw_h)

        # Insert new page
        page = doc.new_page(width=page_w, height=page_h)

        # Convert to temporary JPEG/PNG bytes for insertion
        buf = io.BytesIO()
        if pil_img.mode in ("RGBA", "LA") or (pil_img.mode == "P" and "transparency" in pil_img.info):
            pil_img.save(buf, format="PNG")
        else:
            rgb_img = pil_img.convert("RGB")
            rgb_img.save(buf, format="JPEG", quality=92)
        page.insert_image(rect, stream=buf.getvalue())

    doc.save(str(output_path), deflate=True)
    doc.close()
    return output_path


def scan_to_pdf(
    image_paths: List[Path],
    output_path: Path,
    enhance_contrast: bool = True
) -> Path:
    """Enhance and bundle camera photos / scans into a crisp document PDF."""
    enhanced_paths: List[Path] = []
    temp_dir = Path(tempfile.mkdtemp(prefix="foldora_scan_"))

    try:
        for idx, img_p in enumerate(image_paths):
            with Image.open(img_p) as img:
                img = ImageOps.exif_transpose(img)
                if enhance_contrast:
                    # Convert to grayscale, auto-contrast, and increase sharpness
                    gray = img.convert("L")
                    contrasted = ImageOps.autocontrast(gray, cutoff=2)
                    enhancer = ImageEnhance.Sharpness(contrasted)
                    processed = enhancer.enhance(1.5)
                else:
                    processed = img

                out_p = temp_dir / f"scan_{idx}.jpg"
                processed.convert("RGB").save(out_p, "JPEG", quality=90)
                enhanced_paths.append(out_p)

        return images_to_pdf(enhanced_paths, output_path, orientation="auto", margin_pt=10.0)
    finally:
        shutil.rmtree(temp_dir, ignore_errors=True)


def office_to_pdf(file_path: Path, output_path: Path) -> Path:
    """
    Convert Word (.doc/.docx), PowerPoint (.ppt/.pptx), or Excel (.xls/.xlsx) to PDF.
    Uses headless LibreOffice with isolated profile, or pure-Python document parsers fallback.
    """
    # Guard against decompression bomb payloads in office files
    validate_zip_bomb(file_path)

    libreoffice_bin = shutil.which("libreoffice") or shutil.which("soffice")

    if libreoffice_bin:
        with tempfile.TemporaryDirectory(prefix="libreoffice_profile_") as prof_dir:
            out_dir = output_path.parent
            cmd = [
                libreoffice_bin,
                "--headless",
                "--norestore",
                "--nofirststartwizard",
                "--nologo",
                "--nodefault",
                f"-env:UserInstallation=file:///{prof_dir.replace(chr(92), '/')}",
                "--convert-to", "pdf",
                "--outdir", str(out_dir),
                str(file_path)
            ]
            try:
                res = run_safe_command(cmd, timeout_seconds=90)
                expected_out = out_dir / f"{file_path.stem}.pdf"
                if expected_out.exists() and expected_out.stat().st_size > 0:
                    if expected_out != output_path:
                        shutil.move(str(expected_out), str(output_path))
                    return output_path
            except Exception as exc:
                logger.warning("LibreOffice conversion failed: %s", exc)

    # Pure Python Fallbacks
    suffix = file_path.suffix.lower()

    if suffix in (".docx", ".doc"):
        return _word_to_pdf_fallback(file_path, output_path)
    elif suffix in (".xlsx", ".xls"):
        return _excel_to_pdf_fallback(file_path, output_path)
    elif suffix in (".pptx", ".ppt"):
        return _powerpoint_to_pdf_fallback(file_path, output_path)
    else:
        raise ValueError(f"Unsupported office document format: {suffix}")


def _word_to_pdf_fallback(docx_path: Path, output_path: Path) -> Path:
    """Convert DOCX paragraphs, headings, and tables to PDF via ReportLab."""
    try:
        import docx
    except ImportError:
        raise RuntimeError("python-docx is required for Word conversion")

    doc = docx.Document(docx_path)
    doc_template = SimpleDocTemplate(str(output_path), pagesize=letter)
    styles = getSampleStyleSheet()
    story = []

    for para in doc.paragraphs:
        text = para.text.strip()
        if not text:
            story.append(Spacer(1, 8))
            continue
        safe_text = html_module.escape(text)
        # Check heading style
        style_name = para.style.name.lower()
        if "heading 1" in style_name:
            story.append(Paragraph(safe_text, styles['Heading1']))
        elif "heading 2" in style_name:
            story.append(Paragraph(safe_text, styles['Heading2']))
        elif "heading 3" in style_name:
            story.append(Paragraph(safe_text, styles['Heading3']))
        else:
            story.append(Paragraph(safe_text, styles['Normal']))
        story.append(Spacer(1, 4))

    # Also extract tables
    for table in doc.tables:
        table_data = []
        for row in table.rows:
            table_data.append([html_module.escape(cell.text.strip()) for cell in row.cells])
        if table_data:
            rl_table = Table(table_data)
            rl_table.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#f1f5f9')),
                ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#cbd5e1')),
                ('FONTSIZE', (0, 0), (-1, -1), 9),
            ]))
            story.append(rl_table)
            story.append(Spacer(1, 10))

    if not story:
        story.append(Paragraph("Empty Document", styles['Normal']))

    doc_template.build(story)
    return output_path


def _excel_to_pdf_fallback(xlsx_path: Path, output_path: Path) -> Path:
    """Convert Excel sheets to paginated PDF tables via openpyxl and ReportLab."""
    import openpyxl

    wb = openpyxl.load_workbook(xlsx_path, data_only=True)
    doc_template = SimpleDocTemplate(str(output_path), pagesize=landscape(A4))
    styles = getSampleStyleSheet()
    story = []

    for sheet_name in wb.sheetnames:
        ws = wb[sheet_name]
        safe_sheet = html_module.escape(sheet_name)
        story.append(Paragraph(f"<b>Sheet: {safe_sheet}</b>", styles['Heading2']))
        story.append(Spacer(1, 8))

        data = []
        for row in ws.iter_rows(values_only=True):
            if any(cell is not None for cell in row):
                row_str = [html_module.escape(str(c)) if c is not None else "" for c in row]
                data.append(row_str[:12])  # Bounded column width

        if data:
            rl_table = Table(data)
            rl_table.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#e2e8f0')),
                ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#94a3b8')),
                ('FONTSIZE', (0, 0), (-1, -1), 8),
                ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ]))
            story.append(rl_table)
        story.append(Spacer(1, 16))

    if not story:
        story.append(Paragraph("Empty Spreadsheet", styles['Normal']))

    doc_template.build(story)
    return output_path


def _powerpoint_to_pdf_fallback(pptx_path: Path, output_path: Path) -> Path:
    """Convert PowerPoint slides to PDF pages via python-pptx and ReportLab."""
    from pptx import Presentation

    prs = Presentation(pptx_path)
    doc_template = SimpleDocTemplate(str(output_path), pagesize=landscape(letter))
    styles = getSampleStyleSheet()
    story = []

    for idx, slide in enumerate(prs.slides, start=1):
        title = f"Slide {idx}"
        slide_texts = []
        for shape in slide.shapes:
            if shape.has_text_frame:
                for paragraph in shape.text_frame.paragraphs:
                    t = paragraph.text.strip()
                    if t:
                        slide_texts.append(t)

        story.append(Paragraph(f"<b>{title}</b>", styles['Heading1']))
        story.append(Spacer(1, 12))
        for line in slide_texts:
            story.append(Paragraph(html_module.escape(line), styles['Normal']))
            story.append(Spacer(1, 6))

        story.append(Spacer(1, 30))

    if not story:
        story.append(Paragraph("Empty Presentation", styles['Normal']))

    doc_template.build(story)
    return output_path


def txt_to_pdf(file_path: Path, output_path: Path) -> Path:
    """Format plain text file into cleanly paginated PDF."""
    with open(file_path, "r", encoding="utf-8", errors="replace") as f:
        lines = f.readlines()

    doc_template = SimpleDocTemplate(str(output_path), pagesize=letter, leftMargin=40, rightMargin=40)
    styles = getSampleStyleSheet()
    mono_style = ParagraphStyle(
        'Monospace',
        parent=styles['Normal'],
        fontName='Courier',
        fontSize=9.5,
        leading=13
    )

    story = [Paragraph(f"<b>{file_path.name}</b>", styles['Heading3']), Spacer(1, 10)]
    for line in lines:
        cleaned = line.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;').replace('\t', '    ')
        if not cleaned.strip():
            story.append(Spacer(1, 6))
        else:
            story.append(Paragraph(cleaned, mono_style))

    doc_template.build(story)
    return output_path


def markdown_to_pdf(file_path: Path, output_path: Path) -> Path:
    """Format Markdown document into styled PDF."""
    with open(file_path, "r", encoding="utf-8", errors="replace") as f:
        text = f.read()

    doc_template = SimpleDocTemplate(str(output_path), pagesize=letter)
    styles = getSampleStyleSheet()
    story = []

    def _rl_escape(s: str) -> str:
        return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")

    for line in text.split("\n"):
        line_s = line.strip()
        if not line_s:
            story.append(Spacer(1, 6))
            continue
        if line_s.startswith("# "):
            story.append(Paragraph(f"<b>{_rl_escape(line_s[2:])}</b>", styles['Heading1']))
        elif line_s.startswith("## "):
            story.append(Paragraph(f"<b>{_rl_escape(line_s[3:])}</b>", styles['Heading2']))
        elif line_s.startswith("### "):
            story.append(Paragraph(f"<b>{_rl_escape(line_s[4:])}</b>", styles['Heading3']))
        elif line_s.startswith("- ") or line_s.startswith("* "):
            story.append(Paragraph(f"• {_rl_escape(line_s[2:])}", styles['Normal']))
        else:
            story.append(Paragraph(_rl_escape(line_s), styles['Normal']))
        story.append(Spacer(1, 4))

    doc_template.build(story)
    return output_path


def html_to_pdf(file_path: Path, output_path: Path) -> Path:
    """Safely convert HTML to PDF, disallowing internal networks or local schema exploits."""
    with open(file_path, "r", encoding="utf-8", errors="replace") as f:
        content = f.read()

    # Sanitize HTML content: strip scripts, iframes, XXE, prohibited schemes
    clean_content = sanitize_html_content(content)

    # Find all referenced URLs in HTML tags and CSS
    url_pattern = re.compile(
        r'(?:href|src|xlink:href)\s*=\s*["\']([^"\'>\s]+)["\']|url\(\s*["\']?([^"\'\)\s]+)["\']?\s*\)',
        re.IGNORECASE
    )
    for match in url_pattern.finditer(clean_content):
        url = (match.group(1) or match.group(2) or "").strip()
        if not url:
            continue
        # Allow safe inline image data URIs
        if url.startswith("data:image/"):
            continue
        # Block relative file paths that look like system paths or traversal
        if url.startswith("/") or url.startswith("\\") or ".." in url:
            raise ValueError(f"HTML references prohibited local path: {url}")
        # Disallow prohibited schemes
        if ":" in url and not url.lower().startswith(("http://", "https://")):
            raise ValueError(f"HTML references prohibited URL scheme: {url}")
        # If it's http/https, validate against SSRF
        if url.lower().startswith(("http://", "https://")):
            safe, reason = is_safe_url(url)
            if not safe:
                raise ValueError(f"HTML references prohibited unsafe URL: {url} ({reason})")

    # Extra defense-in-depth string check for common SSRF/local file targets
    low = clean_content.lower()
    if any(h in low for h in ("file://", "gopher://", "169.254.169.254", "metadata.google.internal", "localhost", "127.0.0.1")):
        raise ValueError("HTML contains prohibited local resource or private network references")

    # Use PyMuPDF Story with an empty isolated Archive to prevent local filesystem reads
    doc = pymupdf.open()
    story = pymupdf.Story(clean_content, archive=pymupdf.Archive())
    writer = pymupdf.DocumentWriter(str(output_path))
    more = 1
    while more:
        device = writer.begin_page(pymupdf.Rect(0, 0, 595, 842))
        more, _ = story.place(pymupdf.Rect(36, 36, 559, 806))
        story.draw(device)
        writer.end_page()
    writer.close()
    return output_path
