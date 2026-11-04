import base64
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
    field_values: Dict[str, Any],
    return_stats: bool = False
):
    """Fill PDF AcroForm fields and checkboxes."""
    doc = pymupdf.open(str(file_path))
    total_fields = 0
    filled_fields = 0
    for page in doc:
        for widget in page.widgets():
            total_fields += 1
            if widget.field_name in field_values:
                val = field_values[widget.field_name]
                if widget.field_type == pymupdf.PDF_WIDGET_TYPE_CHECKBOX:
                    widget.field_value = bool(val)
                else:
                    widget.field_value = str(val)
                widget.update()
                filled_fields += 1

    doc.save(str(output_path), deflate=True)
    doc.close()
    if return_stats:
        return output_path, {"total_fields": total_fields, "filled_fields": filled_fields}
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


def apply_visual_edits(
    file_path: Path,
    output_path: Path,
    edits: List[Dict[str, Any]]
) -> Dict[str, Any]:
    """
    Apply visual canvas annotations and text edits to PDF:
    - Text replacements (redact original bbox, insert replacement text)
    - Added text boxes (with custom font size, color, background)
    - Whiteout / redactor blocks
    - Freehand drawing strokes (signatures)
    - Image stamps / uploaded logos
    - Shapes (rectangles, circles)
    """
    doc = pymupdf.open(str(file_path))
    if doc.is_encrypted:
        try:
            doc.authenticate("")
        except Exception:
            pass

    applied_count = 0
    total_pages = len(doc)

    # Group edits by page
    edits_by_page: Dict[int, List[Dict[str, Any]]] = {}
    for edit in edits:
        p_idx = int(edit.get("page", 1)) - 1
        if 0 <= p_idx < total_pages:
            edits_by_page.setdefault(p_idx, []).append(edit)

    for p_idx, page_edits in edits_by_page.items():
        page = doc[p_idx]

        # 1. First pass: Apply all redactions & whiteouts
        for item in page_edits:
            itype = item.get("type")
            if itype == "replace_text":
                bbox = item.get("bbox")
                if bbox and len(bbox) == 4:
                    rect = pymupdf.Rect(*bbox)
                    page.add_redact_annot(rect, fill=(1, 1, 1))
                elif item.get("find_text"):
                    for r in page.search_for(item["find_text"]):
                        page.add_redact_annot(r, fill=(1, 1, 1))
            elif itype == "whiteout":
                bbox = item.get("bbox") or [
                    item.get("x", 0),
                    item.get("y", 0),
                    item.get("x", 0) + item.get("w", 50),
                    item.get("y", 0) + item.get("h", 20)
                ]
                page.add_redact_annot(pymupdf.Rect(*bbox), fill=(1, 1, 1))

        page.apply_redactions()

        # 2. Second pass: Insert replaced text, added text, images, drawings, shapes
        for item in page_edits:
            itype = item.get("type")

            if itype == "replace_text":
                new_text = item.get("replace_text", "")
                if new_text:
                    bbox = item.get("bbox")
                    color = hex_to_rgb(item.get("color", "#111827"))
                    fsize = float(item.get("size", 12.0))
                    if bbox and len(bbox) == 4:
                        pt = pymupdf.Point(bbox[0], bbox[3] - 2.0)
                        page.insert_text(pt, new_text, fontsize=fsize, color=color, overlay=True)
                        applied_count += 1

            elif itype == "add_text":
                text_content = item.get("text", "")
                if text_content:
                    x = float(item.get("x", 72.0))
                    y = float(item.get("y", 72.0))
                    fsize = float(item.get("size", 14.0))
                    color = hex_to_rgb(item.get("color", "#111827"))
                    is_bold = bool(item.get("is_bold", False))
                    is_italic = bool(item.get("is_italic", False))
                    fontname = "hebi" if (is_bold and is_italic) else ("hebo" if is_bold else ("heit" if is_italic else "helv"))
                    bg = item.get("bg_color")
                    if bg and bg != "transparent":
                        bg_rgb = hex_to_rgb(bg)
                        tw = len(text_content) * fsize * 0.55 + 12
                        th = fsize * 1.3
                        page.draw_rect(pymupdf.Rect(x - 4, y - 2, x + tw, y + th), color=bg_rgb, fill=bg_rgb)
                    page.insert_text(pymupdf.Point(x, y + fsize), text_content, fontname=fontname, fontsize=fsize, color=color, overlay=True)
                    applied_count += 1

            elif itype == "drawing":
                points_raw = item.get("points", [])
                if len(points_raw) >= 2:
                    raw_color = item.get("stroke_color") or item.get("color") or "#111827"
                    color = hex_to_rgb(raw_color)
                    width = float(item.get("stroke_width", 2.0))
                    pts = [pymupdf.Point(p[0], p[1]) for p in points_raw]
                    shape = page.new_shape()
                    shape.draw_polyline(pts)
                    shape.finish(color=color, width=width)
                    shape.commit()
                    applied_count += 1

            elif itype == "highlight":
                x = float(item.get("x", 72.0))
                y = float(item.get("y", 72.0))
                w = float(item.get("w", 120.0))
                h = float(item.get("h", 20.0))
                raw_color = item.get("color") or item.get("fill_color") or "#facc15"
                color = hex_to_rgb(raw_color)
                rect = pymupdf.Rect(x, y, x + w, y + h)
                try:
                    annot = page.add_highlight_annot(rect)
                    annot.set_colors(stroke=color)
                    annot.update()
                except Exception:
                    page.draw_rect(rect, color=None, fill=color, fill_opacity=0.35)
                applied_count += 1

            elif itype == "line":
                x1 = float(item.get("x1", item.get("x", 72.0)))
                y1 = float(item.get("y1", item.get("y", 72.0)))
                x2 = float(item.get("x2", x1 + item.get("w", 100.0)))
                y2 = float(item.get("y2", y1 + item.get("h", 0.0)))
                raw_color = item.get("stroke_color") or item.get("color") or "#111827"
                color = hex_to_rgb(raw_color)
                width = float(item.get("stroke_width", 2.0))
                shape = page.new_shape()
                p1 = pymupdf.Point(x1, y1)
                p2 = pymupdf.Point(x2, y2)
                shape.draw_line(p1, p2)
                if item.get("is_arrow"):
                    import math
                    angle = math.atan2(y2 - y1, x2 - x1)
                    arrow_len = 10.0 + width * 2
                    arrow_angle = math.pi / 6.0
                    p_arrow1 = pymupdf.Point(
                        x2 - arrow_len * math.cos(angle - arrow_angle),
                        y2 - arrow_len * math.sin(angle - arrow_angle)
                    )
                    p_arrow2 = pymupdf.Point(
                        x2 - arrow_len * math.cos(angle + arrow_angle),
                        y2 - arrow_len * math.sin(angle + arrow_angle)
                    )
                    shape.draw_line(p2, p_arrow1)
                    shape.draw_line(p2, p_arrow2)
                shape.finish(color=color, width=width)
                shape.commit()
                applied_count += 1

            elif itype == "stamp":
                x = float(item.get("x", 72.0))
                y = float(item.get("y", 72.0))
                w = float(item.get("w", 140.0))
                h = float(item.get("h", 45.0))
                txt = item.get("text", "APPROVED")
                raw_color = item.get("color", "#dc2626")
                color = hex_to_rgb(raw_color)
                rect = pymupdf.Rect(x, y, x + w, y + h)
                shape = page.new_shape()
                shape.draw_rect(rect)
                shape.finish(color=color, width=2.5)
                shape.commit()
                cx = x + 10
                cy = y + (h / 2) + 5
                page.insert_text(pymupdf.Point(cx, cy), txt, fontname="hebo", fontsize=min(18.0, h * 0.45), color=color, overlay=True)
                applied_count += 1

            elif itype == "image":
                img_b64 = item.get("image_base64", "")
                if img_b64 and len(img_b64) <= 15 * 1024 * 1024:
                    try:
                        if "," in img_b64:
                            img_b64 = img_b64.split(",", 1)[1]
                        img_bytes = base64.b64decode(img_b64)
                        x = float(item.get("x", 72.0))
                        y = float(item.get("y", 72.0))
                        w = max(1.0, min(3000.0, float(item.get("width") or item.get("w") or 150.0)))
                        h = max(1.0, min(3000.0, float(item.get("height") or item.get("h") or 100.0)))
                        rect = pymupdf.Rect(x, y, x + w, y + h)
                        page.insert_image(rect, stream=img_bytes, keep_proportion=True)
                        applied_count += 1
                    except Exception as img_err:
                        logger.warning("Failed to insert visual edit image: %s", img_err)

            elif itype == "shape":
                stype = item.get("shape_type", "rect")
                x = float(item.get("x", 72.0))
                y = float(item.get("y", 72.0))
                w = float(item.get("w", 100.0))
                h = float(item.get("h", 50.0))
                stroke_c = hex_to_rgb(item.get("stroke_color", "#111827"))
                sw = float(item.get("stroke_width", 2.0))
                rect = pymupdf.Rect(x, y, x + w, y + h)
                fill_c = hex_to_rgb(item["fill_color"]) if item.get("fill_color") and item.get("fill_color") != "transparent" else None
                if stype == "circle":
                    center = pymupdf.Point(x + w / 2, y + h / 2)
                    radius = min(w, h) / 2
                    page.draw_circle(center, radius, color=stroke_c, fill=fill_c, width=sw)
                else:
                    page.draw_rect(rect, color=stroke_c, fill=fill_c, width=sw)
                applied_count += 1

            elif itype in ["form_text", "form_textfield"]:
                x = float(item.get("x", 72.0))
                y = float(item.get("y", 72.0))
                w = float(item.get("w", 160.0))
                h = float(item.get("h", 28.0))
                field_name = str(item.get("name") or f"text_{p_idx}_{applied_count}")
                val = str(item.get("value") or item.get("default_value") or "")
                
                widget = pymupdf.Widget()
                widget.rect = pymupdf.Rect(x, y, x + w, y + h)
                widget.field_name = field_name
                widget.field_type = pymupdf.PDF_WIDGET_TYPE_TEXT
                widget.field_value = val
                widget.text_fontsize = float(item.get("size", 11.0))
                widget.border_color = (0.7, 0.7, 0.7)
                widget.fill_color = (0.97, 0.98, 0.99)
                page.add_widget(widget)
                applied_count += 1

            elif itype == "form_checkbox":
                x = float(item.get("x", 72.0))
                y = float(item.get("y", 72.0))
                w = float(item.get("w", 20.0))
                h = float(item.get("h", 20.0))
                field_name = str(item.get("name") or f"check_{p_idx}_{applied_count}")
                checked = bool(item.get("checked") or item.get("value"))

                widget = pymupdf.Widget()
                widget.rect = pymupdf.Rect(x, y, x + w, y + h)
                widget.field_name = field_name
                widget.field_type = pymupdf.PDF_WIDGET_TYPE_CHECKBOX
                widget.field_value = checked
                widget.border_color = (0.3, 0.3, 0.3)
                page.add_widget(widget)
                applied_count += 1

            elif itype == "form_signature":
                x = float(item.get("x", 72.0))
                y = float(item.get("y", 72.0))
                w = float(item.get("w", 180.0))
                h = float(item.get("h", 55.0))
                field_name = str(item.get("name") or f"sig_{p_idx}_{applied_count}")

                widget = pymupdf.Widget()
                widget.rect = pymupdf.Rect(x, y, x + w, y + h)
                widget.field_name = field_name
                widget.field_type = pymupdf.PDF_WIDGET_TYPE_SIGNATURE
                page.add_widget(widget)
                # Draw subtle visual outline and indicator so form field is clear in all PDF viewers
                page.draw_rect(widget.rect, color=(0.7, 0.7, 0.7), width=1.0)
                page.insert_text(pymupdf.Point(x + 6, y + h - 8), "Sign Here \u270d", fontsize=9.0, color=(0.4, 0.4, 0.4))
                applied_count += 1


    try:
        doc.save(str(output_path), garbage=3, deflate=True)
    except Exception:
        doc.save(str(output_path), deflate=True)
    doc.close()

    return {
        "success": True,
        "applied_edits_count": applied_count,
        "message": f"Successfully applied {applied_count} visual annotation(s) and edit(s)."
    }
