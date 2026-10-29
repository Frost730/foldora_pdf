import math
import logging
from pathlib import Path
from typing import List, Dict, Any, Optional, Tuple
import pymupdf

logger = logging.getLogger("foldora.editing")


def hex_to_rgb(hex_code: str) -> Tuple[float, float, float]:
    """Convert #RRGGBB hex string to 0.0-1.0 RGB tuple."""
    hex_code = hex_code.lstrip("#")
    if len(hex_code) == 3:
        hex_code = "".join([c * 2 for c in hex_code])
    if len(hex_code) != 6:
        return (0.1, 0.1, 0.1)
    r = int(hex_code[0:2], 16) / 255.0
    g = int(hex_code[2:4], 16) / 255.0
    b = int(hex_code[4:6], 16) / 255.0
    return (r, g, b)


def add_text_to_pdf(
    file_path: Path,
    output_path: Path,
    text: str,
    page_idx: int = 0,
    x: float = 72.0,
    y: float = 72.0,
    font_size: float = 14.0,
    color_hex: str = "#111827"
) -> Path:
    """Insert text at explicit coordinates on a page."""
    doc = pymupdf.open(str(file_path))
    if 0 <= page_idx < len(doc):
        page = doc[page_idx]
        rgb = hex_to_rgb(color_hex)
        page.insert_text(
            pymupdf.Point(x, y),
            text,
            fontsize=font_size,
            color=rgb,
            overlay=True
        )
    doc.save(str(output_path), deflate=True)
    doc.close()
    return output_path


def add_image_to_pdf(
    file_path: Path,
    output_path: Path,
    image_file: Path,
    page_idx: int = 0,
    x: float = 72.0,
    y: float = 72.0,
    width: float = 150.0,
    height: float = 100.0
) -> Path:
    """Insert an image at specified coordinates."""
    doc = pymupdf.open(str(file_path))
    if 0 <= page_idx < len(doc):
        page = doc[page_idx]
        rect = pymupdf.Rect(x, y, x + width, y + height)
        page.insert_image(rect, filename=str(image_file), keep_proportion=True)
    doc.save(str(output_path), deflate=True)
    doc.close()
    return output_path


def highlight_text(
    file_path: Path,
    output_path: Path,
    search_query: str,
    color_hex: str = "#fde047"
) -> Path:
    """Search for text across pages and apply highlight annotations."""
    doc = pymupdf.open(str(file_path))
    rgb = hex_to_rgb(color_hex)

    for page in doc:
        quads = page.search_for(search_query)
        for quad in quads:
            annot = page.add_highlight_annot(quad)
            annot.set_colors(stroke=rgb)
            annot.update()

    doc.save(str(output_path), deflate=True)
    doc.close()
    return output_path


def underline_or_strike(
    file_path: Path,
    output_path: Path,
    search_query: str,
    action: str = "underline",  # "underline", "strikeout"
    color_hex: str = "#ef4444"
) -> Path:
    """Add underline or strikethrough annotations to matching text."""
    doc = pymupdf.open(str(file_path))
    rgb = hex_to_rgb(color_hex)

    for page in doc:
        quads = page.search_for(search_query)
        for quad in quads:
            if action == "strikeout":
                annot = page.add_strikeout_annot(quad)
            else:
                annot = page.add_underline_annot(quad)
            annot.set_colors(stroke=rgb)
            annot.update()

    doc.save(str(output_path), deflate=True)
    doc.close()
    return output_path


def draw_freehand(
    file_path: Path,
    output_path: Path,
    page_idx: int,
    stroke_points: List[Tuple[float, float]],
    color_hex: str = "#2563eb",
    width: float = 2.5
) -> Path:
    """Draw freehand lines onto a page."""
    doc = pymupdf.open(str(file_path))
    if 0 <= page_idx < len(doc) and len(stroke_points) >= 2:
        page = doc[page_idx]
        rgb = hex_to_rgb(color_hex)
        shape = page.new_shape()
        shape.draw_polyline([pymupdf.Point(p[0], p[1]) for p in stroke_points])
        shape.finish(color=rgb, width=width)
        shape.commit()

    doc.save(str(output_path), deflate=True)
    doc.close()
    return output_path


def add_shapes(
    file_path: Path,
    output_path: Path,
    page_idx: int,
    shapes: List[Dict[str, Any]]
) -> Path:
    """Add rectangles, circles, or lines."""
    doc = pymupdf.open(str(file_path))
    if 0 <= page_idx < len(doc):
        page = doc[page_idx]
        shape = page.new_shape()
        for s in shapes:
            stype = s.get("type", "rect")
            stroke_rgb = hex_to_rgb(s.get("stroke_color", "#2563eb"))
            fill_rgb = hex_to_rgb(s.get("fill_color", "#dbeafe")) if s.get("fill") else None
            width = float(s.get("stroke_width", 2.0))

            if stype == "rect":
                r = pymupdf.Rect(s.get("x", 50), s.get("y", 50), s.get("x", 50) + s.get("w", 100), s.get("y", 50) + s.get("h", 80))
                shape.draw_rect(r)
                shape.finish(color=stroke_rgb, fill=fill_rgb, width=width)
            elif stype == "circle":
                center = pymupdf.Point(s.get("cx", 100), s.get("cy", 100))
                shape.draw_circle(center, float(s.get("r", 40)))
                shape.finish(color=stroke_rgb, fill=fill_rgb, width=width)
            elif stype == "line":
                p1 = pymupdf.Point(s.get("x1", 50), s.get("y1", 50))
                p2 = pymupdf.Point(s.get("x2", 150), s.get("y2", 150))
                shape.draw_line(p1, p2)
                shape.finish(color=stroke_rgb, width=width)

        shape.commit()

    doc.save(str(output_path), deflate=True)
    doc.close()
    return output_path


def add_comment_note(
    file_path: Path,
    output_path: Path,
    page_idx: int,
    x: float,
    y: float,
    comment_text: str
) -> Path:
    """Attach standard sticky comment note."""
    doc = pymupdf.open(str(file_path))
    if 0 <= page_idx < len(doc):
        page = doc[page_idx]
        point = pymupdf.Point(x, y)
        annot = page.add_text_annot(point, comment_text, icon="Comment")
        annot.update()
    doc.save(str(output_path), deflate=True)
    doc.close()
    return output_path


def add_watermark(
    file_path: Path,
    output_path: Path,
    text: str = "CONFIDENTIAL",
    opacity: float = 0.3,
    rotation: float = 45.0,
    font_size: float = 48.0,
    color_hex: str = "#94a3b8",
    layer: str = "over"
) -> Path:
    """Stamp diagonal text watermark across all pages."""
    doc = pymupdf.open(str(file_path))
    rgb = hex_to_rgb(color_hex)
    overlay = (layer == "over")

    for page in doc:
        rect = page.rect
        center = pymupdf.Point(rect.width / 2, rect.height / 2)
        shape = page.new_shape()
        # Insert rotated text around center
        morph = (center, pymupdf.Matrix(rotation))
        shape.insert_text(
            center,
            text,
            fontsize=font_size,
            color=rgb,
            morph=morph
        )
        shape.commit(overlay=overlay)

    doc.save(str(output_path), deflate=True)
    doc.close()
    return output_path


def add_header_footer(
    file_path: Path,
    output_path: Path,
    header_left: str = "",
    header_center: str = "",
    header_right: str = "",
    footer_left: str = "",
    footer_center: str = "",
    footer_right: str = "",
    font_size: float = 9.0,
    margin_pt: float = 36.0
) -> Path:
    """Add running headers and footers across pages."""
    doc = pymupdf.open(str(file_path))

    for page in doc:
        rect = page.rect
        # Header (y near top)
        hy = margin_pt + font_size
        if header_left:
            page.insert_text(pymupdf.Point(margin_pt, hy), header_left, fontsize=font_size, color=(0.4, 0.4, 0.4))
        if header_center:
            tlen = pymupdf.get_text_length(header_center, fontsize=font_size)
            page.insert_text(pymupdf.Point((rect.width - tlen) / 2, hy), header_center, fontsize=font_size, color=(0.4, 0.4, 0.4))
        if header_right:
            tlen = pymupdf.get_text_length(header_right, fontsize=font_size)
            page.insert_text(pymupdf.Point(rect.width - margin_pt - tlen, hy), header_right, fontsize=font_size, color=(0.4, 0.4, 0.4))

        # Footer (y near bottom)
        fy = rect.height - margin_pt
        if footer_left:
            page.insert_text(pymupdf.Point(margin_pt, fy), footer_left, fontsize=font_size, color=(0.4, 0.4, 0.4))
        if footer_center:
            tlen = pymupdf.get_text_length(footer_center, fontsize=font_size)
            page.insert_text(pymupdf.Point((rect.width - tlen) / 2, fy), footer_center, fontsize=font_size, color=(0.4, 0.4, 0.4))
        if footer_right:
            tlen = pymupdf.get_text_length(footer_right, fontsize=font_size)
            page.insert_text(pymupdf.Point(rect.width - margin_pt - tlen, fy), footer_right, fontsize=font_size, color=(0.4, 0.4, 0.4))

    doc.save(str(output_path), deflate=True)
    doc.close()
    return output_path


def add_stamp(
    file_path: Path,
    output_path: Path,
    stamp_text: str = "APPROVED",
    color_hex: str = "#16a34a",
    page_idx: int = 0,
    x: float = 380.0,
    y: float = 60.0
) -> Path:
    """Stamp a professional badge (e.g. APPROVED, CONFIDENTIAL, DRAFT, VOID)."""
    doc = pymupdf.open(str(file_path))
    if 0 <= page_idx < len(doc):
        page = doc[page_idx]
        rgb = hex_to_rgb(color_hex)
        shape = page.new_shape()

        font_size = 14.0
        text_len = pymupdf.get_text_length(stamp_text, fontsize=font_size)
        pad = 8.0
        rect = pymupdf.Rect(x, y, x + text_len + (2 * pad), y + font_size + (2 * pad))

        # Draw stamp border and background
        shape.draw_rect(rect)
        shape.finish(color=rgb, fill=(rgb[0], rgb[1], rgb[2]), width=2.0)
        # Invert text for contrast or draw bordered box
        shape.commit()

        # Inner text
        page.insert_text(
            pymupdf.Point(x + pad, y + pad + font_size - 2),
            stamp_text,
            fontsize=font_size,
            color=(1.0, 1.0, 1.0),
            overlay=True
        )

    doc.save(str(output_path), deflate=True)
    doc.close()
    return output_path


def fill_form_fields(
    file_path: Path,
    output_path: Path,
    field_values: Dict[str, Any]
) -> Path:
    """Fill PDF AcroForm fields and checkboxes."""
    doc = pymupdf.open(str(file_path))
    for page in doc:
        for widget in page.widgets():
            if widget.field_name in field_values:
                val = field_values[widget.field_name]
                if widget.field_type == pymupdf.PDF_WIDGET_TYPE_CHECKBOX:
                    widget.field_value = bool(val)
                else:
                    widget.field_value = str(val)
                widget.update()

    doc.save(str(output_path), deflate=True)
    doc.close()
    return output_path


def replace_text_in_pdf(
    file_path: Path,
    output_path: Path,
    find_text: str,
    replace_text: str,
    page_indices_str: Optional[str] = None,
    color_hex: str = "#111827",
    font_size: Optional[float] = None
) -> Dict[str, Any]:
    """Search for existing text in PDF and replace it in-place."""
    if not find_text or not find_text.strip():
        raise ValueError("Search text cannot be empty")

    find_text = find_text.strip()
    doc = pymupdf.open(str(file_path))
    if doc.is_encrypted:
        try:
            doc.authenticate("")
        except Exception:
            pass

    total_pages = len(doc)
    replacement_count = 0
    rgb = hex_to_rgb(color_hex)

    from app.services.pdf.organize import parse_page_ranges
    if page_indices_str and page_indices_str.strip():
        targets = set(parse_page_ranges(page_indices_str, total_pages))
    else:
        targets = set(range(total_pages))

    for idx in targets:
        if idx < 0 or idx >= total_pages:
            continue
        page = doc[idx]
        quads = page.search_for(find_text)
        if not quads:
            continue

        # Redact matches on this page
        for rect in quads:
            page.add_redact_annot(rect, fill=(1, 1, 1))
        page.apply_redactions()

        # Insert replacement text
        if replace_text:
            for rect in quads:
                fsize = font_size if font_size else max(8.0, rect.height * 0.85)
                page.insert_text(
                    pymupdf.Point(rect.x0, rect.y1 - (rect.height * 0.15)),
                    replace_text,
                    fontsize=fsize,
                    color=rgb,
                    overlay=True
                )
        replacement_count += len(quads)

    try:
        doc.save(str(output_path), garbage=3, deflate=True)
    except Exception:
        doc.save(str(output_path), deflate=True)
    doc.close()

    if replacement_count > 0:
        msg = f"Successfully replaced {replacement_count} instance(s) of '{find_text}'."
    else:
        msg = f"Text '{find_text}' was not found in the selected pages. If this is a scanned document, run OCR PDF first."

    return {
        "success": True,
        "replacements_count": replacement_count,
        "find_text": find_text,
        "replace_text": replace_text,
        "message": msg
    }
