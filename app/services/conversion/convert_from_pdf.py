import csv
import io
import logging
from pathlib import Path
from typing import List, Optional
import pymupdf
from PIL import Image

logger = logging.getLogger("foldora.conversion.from_pdf")


def pdf_to_images(
    file_path: Path,
    output_dir: Path,
    img_format: str = "png",  # "png", "jpeg", "jpg"
    dpi: int = 150,
    page_indices: Optional[List[int]] = None
) -> List[Path]:
    """Render PDF pages as high-resolution images."""
    doc = pymupdf.open(str(file_path))
    total_pages = len(doc)
    generated: List[Path] = []
    base_stem = file_path.stem

    indices = page_indices if page_indices is not None else list(range(total_pages))
    scale = dpi / 72.0
    mat = pymupdf.Matrix(scale, scale)

    ext = "jpg" if img_format in ("jpg", "jpeg") else "png"

    for idx in indices:
        if 0 <= idx < total_pages:
            page = doc[idx]
            pix = page.get_pixmap(matrix=mat, alpha=(ext == "png"))
            out_file = output_dir / f"{base_stem}_page_{idx + 1}.{ext}"
            if ext == "jpg":
                # Convert pixmap to PIL to ensure optimal JPEG quality
                img = Image.frombytes("RGB", [pix.width, pix.height], pix.samples)
                img.save(out_file, "JPEG", quality=90)
            else:
                pix.save(str(out_file))
            generated.append(out_file)

    doc.close()
    return generated


def pdf_to_docx(file_path: Path, output_path: Path) -> Path:
    """Convert PDF text, paragraphs, and tables into an editable Word DOCX."""
    import docx
    from docx.shared import Pt, Inches, RGBColor

    doc = pymupdf.open(str(file_path))
    word_doc = docx.Document()

    # Set 0.75-inch standard margins
    for section in word_doc.sections:
        section.top_margin = Inches(0.75)
        section.bottom_margin = Inches(0.75)
        section.left_margin = Inches(0.75)
        section.right_margin = Inches(0.75)

    for p_idx, page in enumerate(doc):
        if p_idx > 0:
            word_doc.add_page_break()

        # Extract structured text blocks: (x0, y0, x1, y1, text, block_no, block_type)
        blocks = page.get_text("blocks")
        # Try table detection first
        tables = page.find_tables()
        table_rects = [t.bbox for t in tables]

        for b in blocks:
            # Check if block is inside any table
            b_rect = pymupdf.Rect(b[:4])
            is_in_table = any(b_rect.intersects(pymupdf.Rect(tr)) for tr in table_rects)
            if is_in_table:
                continue

            text = b[4].strip()
            if not text:
                continue

            # Heuristic for headings based on line length or capital letters
            lines = text.split("\n")
            first_line = lines[0].strip()
            if len(first_line) < 60 and (first_line.isupper() or len(lines) == 1 and len(first_line) < 40):
                heading_p = word_doc.add_heading(first_line, level=2)
                for line in lines[1:]:
                    if line.strip():
                        word_doc.add_paragraph(line.strip())
            else:
                word_doc.add_paragraph(text.replace("\n", " "))

        # Insert detected tables
        for table in tables:
            table_data = table.extract()
            if not table_data:
                continue
            rows = len(table_data)
            cols = len(table_data[0]) if rows > 0 else 0
            if rows > 0 and cols > 0:
                doc_table = word_doc.add_table(rows=rows, cols=cols)
                doc_table.style = 'Table Grid'
                for r_i, row in enumerate(table_data):
                    for c_i, cell_text in enumerate(row):
                        doc_table.cell(r_i, c_i).text = str(cell_text or "").strip()
                word_doc.add_paragraph()

    word_doc.save(str(output_path))
    doc.close()
    return output_path


def pdf_to_xlsx(file_path: Path, output_path: Path) -> Path:
    """Extract detected tables and structured data into an Excel spreadsheet."""
    import openpyxl
    from openpyxl.styles import Font, PatternFill, Alignment, Border, Side

    doc = pymupdf.open(str(file_path))
    wb = openpyxl.Workbook()
    # Remove default sheet
    wb.remove(wb.active)

    table_found = False
    header_fill = PatternFill(start_color="1E293B", end_color="1E293B", fill_type="solid")
    header_font = Font(name="Calibri", size=11, bold=True, color="FFFFFF")
    cell_border = Border(
        left=Side(style='thin', color='CBD5E1'),
        right=Side(style='thin', color='CBD5E1'),
        top=Side(style='thin', color='CBD5E1'),
        bottom=Side(style='thin', color='CBD5E1')
    )

    for p_idx, page in enumerate(doc):
        tables = page.find_tables()
        if not tables.tables:
            # Fallback: extract tabbed text or rows
            continue

        ws = wb.create_sheet(title=f"Page {p_idx + 1}")
        current_row = 1

        for t_idx, table in enumerate(tables):
            table_found = True
            data = table.extract()
            if not data:
                continue

            for r_idx, row in enumerate(data):
                for c_idx, val in enumerate(row):
                    cell = ws.cell(row=current_row, column=c_idx + 1, value=str(val or "").strip())
                    cell.border = cell_border
                    if r_idx == 0:
                        cell.fill = header_fill
                        cell.font = header_font
                        cell.alignment = Alignment(horizontal="center", vertical="center")
                    else:
                        cell.alignment = Alignment(horizontal="left", vertical="center")
                current_row += 1
            current_row += 2  # Gap between tables

    # If no structured tables were detected, extract page text line by line
    if not table_found:
        ws = wb.create_sheet(title="Extracted Text")
        row_num = 1
        for p_idx, page in enumerate(doc):
            ws.cell(row=row_num, column=1, value=f"--- Page {p_idx + 1} ---").font = Font(bold=True)
            row_num += 1
            text = page.get_text("text")
            for line in text.split("\n"):
                if line.strip():
                    ws.cell(row=row_num, column=1, value=line.strip())
                    row_num += 1
            row_num += 1

    wb.save(str(output_path))
    doc.close()
    return output_path


def pdf_to_pptx(file_path: Path, output_path: Path) -> Path:
    """Convert each PDF page into a high-resolution PowerPoint presentation slide."""
    from pptx import Presentation
    from pptx.util import Inches

    doc = pymupdf.open(str(file_path))
    prs = Presentation()
    # Configure 16:9 widescreen or match page aspect ratio
    prs.slide_width = Inches(13.333)
    prs.slide_height = Inches(7.5)
    blank_layout = prs.slide_layouts[6]

    for p_idx, page in enumerate(doc):
        # Render high-res slide image
        pix = page.get_pixmap(dpi=150)
        img_bytes = pix.tobytes("png")
        img_stream = io.BytesIO(img_bytes)

        slide = prs.slides.add_slide(blank_layout)

        # Calculate fitting into 13.333 x 7.5
        page_ratio = page.rect.width / page.rect.height
        target_ratio = 13.333 / 7.5

        if page_ratio > target_ratio:
            w = Inches(13.333)
            h = Inches(13.333 / page_ratio)
            left = Inches(0)
            top = (Inches(7.5) - h) / 2
        else:
            h = Inches(7.5)
            w = Inches(7.5 * page_ratio)
            top = Inches(0)
            left = (Inches(13.333) - w) / 2

        slide.shapes.add_picture(img_stream, left, top, width=w, height=h)

    prs.save(str(output_path))
    doc.close()
    return output_path


def pdf_to_txt(file_path: Path, output_path: Path) -> Path:
    """Extract full plain text with page dividers."""
    doc = pymupdf.open(str(file_path))
    with open(output_path, "w", encoding="utf-8") as f:
        for p_idx, page in enumerate(doc):
            f.write(f"\n--- [ PAGE {p_idx + 1} ] ---\n\n")
            f.write(page.get_text("text"))
            f.write("\n")
    doc.close()
    return output_path


def pdf_to_html(file_path: Path, output_path: Path) -> Path:
    """Convert PDF content into accessible HTML5 markup with sandboxed CSP."""
    import html as html_module
    doc = pymupdf.open(str(file_path))
    safe_title = html_module.escape(file_path.stem)
    html_parts = [
        "<!DOCTYPE html>",
        "<html lang=\"en\">",
        "<head>",
        "<meta charset=\"UTF-8\">",
        "<meta http-equiv=\"Content-Security-Policy\" content=\"default-src 'none'; style-src 'unsafe-inline'; img-src data:;\">",
        f"<title>{safe_title}</title>",
        "<style>",
        "body { font-family: system-ui, -apple-system, sans-serif; background: #f8fafc; color: #1e293b; margin: 0; padding: 24px; }",
        ".page-container { max-width: 800px; margin: 0 auto 32px auto; background: #fff; padding: 48px; border-radius: 8px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); }",
        ".page-header { color: #64748b; font-size: 12px; margin-bottom: 24px; border-bottom: 1px solid #e2e8f0; padding-bottom: 8px; }",
        "</style>",
        "</head>",
        "<body>"
    ]

    for p_idx, page in enumerate(doc):
        html_parts.append(f"<div class=\"page-container\"><div class=\"page-header\">Page {p_idx + 1} of {len(doc)}</div>")
        html_parts.append(page.get_text("html"))
        html_parts.append("</div>")

    html_parts.append("</body></html>")
    with open(output_path, "w", encoding="utf-8") as f:
        f.write("\n".join(html_parts))

    doc.close()
    return output_path


def pdf_to_markdown(file_path: Path, output_path: Path) -> Path:
    """Extract document text formatted as clean Markdown."""
    doc = pymupdf.open(str(file_path))
    md_lines = [f"# {file_path.stem}\n"]

    for p_idx, page in enumerate(doc):
        md_lines.append(f"\n## Page {p_idx + 1}\n")
        blocks = page.get_text("blocks")
        for b in blocks:
            text = b[4].strip()
            if not text:
                continue
            lines = text.split("\n")
            if len(lines) == 1 and len(lines[0]) < 50:
                md_lines.append(f"\n### {lines[0]}\n")
            else:
                md_lines.append(f"\n{text}\n")

    with open(output_path, "w", encoding="utf-8") as f:
        f.write("\n".join(md_lines))

    doc.close()
    return output_path


def extract_tables(file_path: Path, output_dir: Path, output_format: str = "csv") -> List[Path]:
    """Detect and extract tables into CSV or Excel files."""
    doc = pymupdf.open(str(file_path))
    generated: List[Path] = []
    base_stem = file_path.stem
    table_count = 0

    for p_idx, page in enumerate(doc):
        tables = page.find_tables()
        for t_idx, table in enumerate(tables):
            table_count += 1
            data = table.extract()
            if not data:
                continue

            out_file = output_dir / f"{base_stem}_table_p{p_idx + 1}_{t_idx + 1}.csv"
            with open(out_file, "w", newline="", encoding="utf-8") as f:
                writer = csv.writer(f)
                for row in data:
                    writer.writerow([str(cell or "").strip() for cell in row])
            generated.append(out_file)

    doc.close()
    if not generated:
        # Create an empty notice CSV if no tables were detected
        fallback_file = output_dir / f"{base_stem}_tables.csv"
        with open(fallback_file, "w", newline="", encoding="utf-8") as f:
            writer = csv.writer(f)
            writer.writerow(["Notice"])
            writer.writerow(["No structured tabular grids detected in this PDF."])
        generated.append(fallback_file)

    return generated


def extract_images(file_path: Path, output_dir: Path) -> List[Path]:
    """Extract all embedded raster images from PDF streams."""
    doc = pymupdf.open(str(file_path))
    generated: List[Path] = []
    base_stem = file_path.stem
    seen_xrefs = set()

    for p_idx, page in enumerate(doc):
        image_list = page.get_images(full=True)
        for img_idx, img_info in enumerate(image_list):
            xref = img_info[0]
            if xref in seen_xrefs:
                continue
            seen_xrefs.add(xref)

            base_image = doc.extract_image(xref)
            if not base_image:
                continue

            image_bytes = base_image["image"]
            image_ext = base_image["ext"]

            out_file = output_dir / f"{base_stem}_img_p{p_idx + 1}_{img_idx + 1}.{image_ext}"
            with open(out_file, "wb") as f:
                f.write(image_bytes)
            generated.append(out_file)

    doc.close()
    return generated
