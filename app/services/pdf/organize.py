import re
from pathlib import Path
from typing import List, Optional, Tuple, Dict, Any
import pymupdf


def parse_page_ranges(range_str: str, max_pages: int) -> List[int]:
    """
    Parse a range string like '1-3, 5, 7-9' into 0-indexed page indices.
    """
    indices: List[int] = []
    if not range_str.strip():
        return list(range(max_pages))

    parts = range_str.split(",")
    for part in parts:
        part = part.strip()
        if not part:
            continue
        if "-" in part:
            match = re.match(r"^(\d+)\s*-\s*(\d+)$", part)
            if match:
                start = max(1, int(match.group(1)))
                end = min(max_pages, int(match.group(2)))
                if start <= end:
                    indices.extend(range(start - 1, end))
                else:
                    indices.extend(range(end - 1, start))
        else:
            if part.isdigit():
                p = int(part)
                if 1 <= p <= max_pages:
                    indices.append(p - 1)

    # Return unique or preserve order
    seen = set()
    result = []
    for idx in indices:
        if idx not in seen and 0 <= idx < max_pages:
            seen.add(idx)
            result.append(idx)
    return result


def merge_pdfs(file_paths: List[Path], output_path: Path) -> Path:
    """Merge multiple PDF files into one."""
    if not file_paths:
        raise ValueError("At least one PDF file is required to merge")

    doc_out = pymupdf.open()
    for fp in file_paths:
        doc_in = pymupdf.open(str(fp))
        doc_out.insert_pdf(doc_in)
        doc_in.close()

    doc_out.save(str(output_path), garbage=3, deflate=True)
    doc_out.close()
    return output_path


def split_pdf(
    file_path: Path,
    output_dir: Path,
    mode: str = "ranges",  # "ranges", "each_page", "fixed_count"
    ranges_str: str = "1",
    pages_per_doc: int = 1
) -> List[Path]:
    """Split a PDF into multiple documents according to user options."""
    doc = pymupdf.open(str(file_path))
    total_pages = len(doc)
    if total_pages == 0:
        doc.close()
        raise ValueError("Cannot split an empty PDF")

    generated_files: List[Path] = []
    base_stem = file_path.stem

    if mode == "each_page":
        for i in range(total_pages):
            out_doc = pymupdf.open()
            out_doc.insert_pdf(doc, from_page=i, to_page=i)
            out_name = output_dir / f"{base_stem}_page_{i + 1}.pdf"
            out_doc.save(str(out_name), deflate=True)
            out_doc.close()
            generated_files.append(out_name)

    elif mode == "fixed_count":
        step = max(1, pages_per_doc)
        chunk_idx = 1
        for start in range(0, total_pages, step):
            end = min(total_pages - 1, start + step - 1)
            out_doc = pymupdf.open()
            out_doc.insert_pdf(doc, from_page=start, to_page=end)
            out_name = output_dir / f"{base_stem}_part_{chunk_idx}_p{start + 1}-p{end + 1}.pdf"
            out_doc.save(str(out_name), deflate=True)
            out_doc.close()
            generated_files.append(out_name)
            chunk_idx += 1

    else:  # mode == "ranges"
        range_groups = [r.strip() for r in ranges_str.split(";") if r.strip()]
        if not range_groups:
            range_groups = [ranges_str]

        for idx, r_str in enumerate(range_groups, start=1):
            page_indices = parse_page_ranges(r_str, total_pages)
            if not page_indices:
                continue
            out_doc = pymupdf.open()
            for p in page_indices:
                out_doc.insert_pdf(doc, from_page=p, to_page=p)
            out_name = output_dir / f"{base_stem}_split_range_{idx}.pdf"
            out_doc.save(str(out_name), deflate=True)
            out_doc.close()
            generated_files.append(out_name)

    doc.close()
    if not generated_files:
        raise ValueError("No pages selected for splitting")
    return generated_files


def organize_pdf(
    file_path: Path,
    output_path: Path,
    page_order: List[Dict[str, Any]]
) -> Path:
    """
    Reorder, rotate, delete, or duplicate pages based on an ordered list of operations:
    page_order: [ { "source_page": 0, "rotation": 0 }, ... ]
    """
    src_doc = pymupdf.open(str(file_path))
    total_pages = len(src_doc)
    out_doc = pymupdf.open()

    for item in page_order:
        src_idx = int(item.get("source_page", 0))
        rotation = int(item.get("rotation", 0)) % 360
        if 0 <= src_idx < total_pages:
            # Insert this page into the output document
            out_doc.insert_pdf(src_doc, from_page=src_idx, to_page=src_idx)
            new_page = out_doc[-1]
            if rotation:
                new_page.set_rotation((new_page.rotation + rotation) % 360)

    if len(out_doc) == 0:
        src_doc.close()
        out_doc.close()
        raise ValueError("Organized PDF would contain 0 pages")

    out_doc.save(str(output_path), garbage=3, deflate=True)
    src_doc.close()
    out_doc.close()
    return output_path


def extract_pages(
    file_path: Path,
    output_dir: Path,
    pages_str: str,
    as_single_file: bool = True
) -> List[Path]:
    """Extract specified pages into a single PDF or multiple PDFs."""
    doc = pymupdf.open(str(file_path))
    total_pages = len(doc)
    page_indices = parse_page_ranges(pages_str, total_pages)
    if not page_indices:
        doc.close()
        raise ValueError("No valid pages selected for extraction")

    results: List[Path] = []
    base_stem = file_path.stem

    if as_single_file:
        out_doc = pymupdf.open()
        for p in page_indices:
            out_doc.insert_pdf(doc, from_page=p, to_page=p)
        out_path = output_dir / f"{base_stem}_extracted.pdf"
        out_doc.save(str(out_path), deflate=True)
        out_doc.close()
        results.append(out_path)
    else:
        for p in page_indices:
            out_doc = pymupdf.open()
            out_doc.insert_pdf(doc, from_page=p, to_page=p)
            out_path = output_dir / f"{base_stem}_page_{p + 1}.pdf"
            out_doc.save(str(out_path), deflate=True)
            out_doc.close()
            results.append(out_path)

    doc.close()
    return results


def remove_pages(
    file_path: Path,
    output_path: Path,
    pages_to_remove_str: str
) -> Path:
    """Remove specified pages from the PDF."""
    doc = pymupdf.open(str(file_path))
    total_pages = len(doc)
    remove_indices = set(parse_page_ranges(pages_to_remove_str, total_pages))

    if len(remove_indices) >= total_pages:
        doc.close()
        raise ValueError("Cannot remove all pages from the document")

    # Delete in reverse order so indices remain valid
    for idx in sorted(remove_indices, reverse=True):
        doc.delete_page(idx)

    doc.save(str(output_path), garbage=3, deflate=True)
    doc.close()
    return output_path


def rotate_pdf(
    file_path: Path,
    output_path: Path,
    angle: int = 90,
    page_indices_str: Optional[str] = None
) -> Path:
    """Rotate all or selected pages by angle (90, 180, 270)."""
    doc = pymupdf.open(str(file_path))
    total_pages = len(doc)

    if page_indices_str and page_indices_str.strip():
        targets = set(parse_page_ranges(page_indices_str, total_pages))
    else:
        targets = set(range(total_pages))

    for idx in targets:
        page = doc[idx]
        current_rot = page.rotation
        page.set_rotation((current_rot + angle) % 360)

    doc.save(str(output_path), deflate=True)
    doc.close()
    return output_path


def add_page_numbers(
    file_path: Path,
    output_path: Path,
    position: str = "bottom_center",  # top_left, top_center, top_right, bottom_left, bottom_center, bottom_right
    format_str: str = "Page {n} of {total}",
    start_num: int = 1,
    font_size: float = 10.0,
    margin_pt: float = 36.0,
    exclude_pages_str: Optional[str] = None
) -> Path:
    """Stamp page numbers onto PDF pages."""
    doc = pymupdf.open(str(file_path))
    total_pages = len(doc)

    exclude_set = set()
    if exclude_pages_str and exclude_pages_str.strip():
        exclude_set = set(parse_page_ranges(exclude_pages_str, total_pages))

    for idx, page in enumerate(doc):
        if idx in exclude_set:
            continue
        rect = page.rect
        current_num = start_num + idx
        text = format_str.format(n=current_num, total=total_pages)

        # Calculate coordinates
        text_len = pymupdf.get_text_length(text, fontsize=font_size)

        if "top" in position:
            y = margin_pt + font_size
        else:
            y = rect.height - margin_pt

        if "left" in position:
            x = margin_pt
        elif "right" in position:
            x = rect.width - margin_pt - text_len
        else:  # center
            x = (rect.width - text_len) / 2

        # Insert text
        page.insert_text(
            pymupdf.Point(x, y),
            text,
            fontsize=font_size,
            color=(0.2, 0.2, 0.2),
            overlay=True
        )

    doc.save(str(output_path), deflate=True)
    doc.close()
    return output_path


def crop_pdf(
    file_path: Path,
    output_path: Path,
    top: float = 0.0,
    bottom: float = 0.0,
    left: float = 0.0,
    right: float = 0.0,
    page_indices_str: Optional[str] = None
) -> Path:
    """Crop margins from PDF pages."""
    doc = pymupdf.open(str(file_path))
    total_pages = len(doc)

    if page_indices_str and page_indices_str.strip():
        targets = set(parse_page_ranges(page_indices_str, total_pages))
    else:
        targets = set(range(total_pages))

    for idx in targets:
        page = doc[idx]
        rect = page.rect
        new_rect = pymupdf.Rect(
            rect.x0 + left,
            rect.y0 + top,
            rect.x1 - right,
            rect.y1 - bottom
        )
        # Check sanity
        if new_rect.width > 20 and new_rect.height > 20:
            page.set_cropbox(new_rect)

    doc.save(str(output_path), deflate=True)
    doc.close()
    return output_path
