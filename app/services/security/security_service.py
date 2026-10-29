import difflib
import json
import logging
from pathlib import Path
from typing import Dict, Any, List, Optional
import pymupdf

logger = logging.getLogger("foldora.security_service")


def protect_pdf(
    file_path: Path,
    output_path: Path,
    user_password: str,
    owner_password: Optional[str] = None
) -> Path:
    """Encrypt PDF using standard AES-128 or AES-256 encryption."""
    if not user_password:
        raise ValueError("Password cannot be empty")

    doc = pymupdf.open(str(file_path))
    perm = pymupdf.PDF_PERM_ACCESSIBILITY | pymupdf.PDF_PERM_PRINT
    owner_pwd = owner_password if owner_password else user_password

    doc.save(
        str(output_path),
        encryption=pymupdf.PDF_ENCRYPT_AES_256,
        user_pw=user_password,
        owner_pw=owner_pwd,
        permissions=perm,
        deflate=True
    )
    doc.close()
    return output_path


def unlock_pdf(
    file_path: Path,
    output_path: Path,
    password: str
) -> Path:
    """Decrypt and remove password restrictions using the valid authorized password."""
    doc = pymupdf.open(str(file_path))
    if doc.is_encrypted:
        success = doc.authenticate(password)
        if not success:
            doc.close()
            raise ValueError("Incorrect password provided for encrypted document")

    # Save unencrypted document
    doc.save(str(output_path), encryption=pymupdf.PDF_ENCRYPT_NONE, deflate=True)
    doc.close()
    return output_path


def redact_pdf(
    file_path: Path,
    output_path: Path,
    redactions: Optional[List[Dict[str, Any]]] = None,
    search_keywords: Optional[List[str]] = None
) -> Dict[str, Any]:
    """
    PERMANENT REDACTION: Actually removes underlying text and raster data
    under redaction rectangles from the PDF binary.
    """
    doc = pymupdf.open(str(file_path))
    redaction_count = 0

    # 1. Apply keyword-based redactions
    if search_keywords:
        for kw in search_keywords:
            kw = kw.strip()
            if not kw:
                continue
            for page in doc:
                quads = page.search_for(kw)
                for q in quads:
                    page.add_redact_annot(q, fill=(0, 0, 0))
                    redaction_count += 1

    # 2. Apply explicit coordinate-based redactions:
    # [ { "page": 0, "x": 100, "y": 150, "w": 200, "h": 20 } ]
    if redactions:
        for r in redactions:
            p_idx = int(r.get("page", 0))
            if 0 <= p_idx < len(doc):
                page = doc[p_idx]
                rect = pymupdf.Rect(r["x"], r["y"], r["x"] + r["w"], r["y"] + r["h"])
                page.add_redact_annot(rect, fill=(0, 0, 0))
                redaction_count += 1

    # Apply redactions to commit permanent byte scrub
    for page in doc:
        page.apply_redactions()

    # Save with full garbage collection to permanently eliminate scrubbed streams
    doc.save(str(output_path), garbage=4, deflate=True, clean=True)
    doc.close()

    # Verification check: inspect if any keyword remains in the output
    verification_passed = True
    if search_keywords:
        val_doc = pymupdf.open(str(output_path))
        for kw in search_keywords:
            if not kw.strip():
                continue
            for page in val_doc:
                if page.search_for(kw.strip()):
                    verification_passed = False
                    break
        val_doc.close()

    return {
        "success": True,
        "redactions_applied": redaction_count,
        "verified_sanitized": verification_passed,
        "message": f"Applied {redaction_count} permanent redaction(s). Content byte-scrubbed."
    }


def remove_metadata(file_path: Path, output_path: Path) -> Path:
    """Strip all author, creator, software, and XMP metadata streams."""
    doc = pymupdf.open(str(file_path))
    # Clear Info dictionary
    doc.set_metadata({
        "format": "PDF",
        "title": "",
        "author": "",
        "subject": "",
        "keywords": "",
        "creator": "",
        "producer": "Foldora Sanitizer",
        "creationDate": "",
        "modDate": "",
        "trapped": ""
    })
    # Clear XMP
    try:
        doc.set_xml_metadata("")
    except Exception:
        pass

    doc.save(str(output_path), garbage=4, deflate=True, clean=True)
    doc.close()
    return output_path


def compare_pdfs(file1: Path, file2: Path, output_path: Path) -> Dict[str, Any]:
    """Compare two PDFs for text additions, deletions, and structural variance."""
    doc1 = pymupdf.open(str(file1))
    doc2 = pymupdf.open(str(file2))

    pages1 = len(doc1)
    pages2 = len(doc2)

    text1_lines = []
    for p in doc1:
        text1_lines.extend(p.get_text("text").splitlines())

    text2_lines = []
    for p in doc2:
        text2_lines.extend(p.get_text("text").splitlines())

    doc1.close()
    doc2.close()

    diff = list(difflib.unified_diff(
        text1_lines,
        text2_lines,
        fromfile=file1.name,
        tofile=file2.name,
        lineterm=""
    ))

    additions = sum(1 for line in diff if line.startswith("+") and not line.startswith("+++"))
    deletions = sum(1 for line in diff if line.startswith("-") and not line.startswith("---"))

    # Write human-readable comparison report
    with open(output_path, "w", encoding="utf-8") as f:
        f.write("=====================================================\n")
        f.write("             FOLDORA PDF COMPARISON REPORT           \n")
        f.write("=====================================================\n\n")
        f.write(f"Original File: {file1.name} ({pages1} pages)\n")
        f.write(f"Modified File: {file2.name} ({pages2} pages)\n\n")
        f.write(f"Summary of Changes:\n")
        f.write(f"  - Additions (+): {additions} line(s)\n")
        f.write(f"  - Deletions (-): {deletions} line(s)\n")
        f.write(f"  - Page Count Delta: {pages2 - pages1}\n\n")
        f.write("Detailed Line-by-Line Diff:\n")
        f.write("-----------------------------------------------------\n")
        if diff:
            f.write("\n".join(diff))
        else:
            f.write("No textual differences detected between the two documents.\n")

    return {
        "identical": len(diff) == 0,
        "page_count_file1": pages1,
        "page_count_file2": pages2,
        "additions": additions,
        "deletions": deletions,
        "report_file": output_path.name
    }


def get_pdf_info(file_path: Path) -> Dict[str, Any]:
    """Inspect and extract document technical metadata safely."""
    doc = pymupdf.open(str(file_path))
    meta = doc.metadata or {}
    total_pages = len(doc)

    page_dims = []
    for i in range(min(total_pages, 5)):
        p = doc[i]
        page_dims.append({
            "page": i + 1,
            "width_pt": round(p.rect.width, 1),
            "height_pt": round(p.rect.height, 1),
            "rotation": p.rotation
        })

    fonts_found = set()
    for page in doc:
        for f in page.get_fonts():
            fonts_found.add(f[3])

    is_enc = doc.is_encrypted
    permissions = doc.permissions
    doc.close()

    return {
        "filename": file_path.name,
        "file_size_bytes": file_path.stat().st_size,
        "total_pages": total_pages,
        "is_encrypted": is_enc,
        "permissions": permissions,
        "metadata": {
            "title": meta.get("title", ""),
            "author": meta.get("author", ""),
            "subject": meta.get("subject", ""),
            "keywords": meta.get("keywords", ""),
            "creator": meta.get("creator", ""),
            "producer": meta.get("producer", ""),
            "creation_date": meta.get("creationDate", ""),
            "mod_date": meta.get("modDate", ""),
        },
        "sample_pages": page_dims,
        "unique_fonts_count": len(fonts_found),
        "fonts": sorted(list(fonts_found))[:15]
    }


def check_pdf_integrity(file_path: Path) -> Dict[str, Any]:
    """Run structural integrity diagnostics."""
    issues = []
    is_valid = True

    try:
        doc = pymupdf.open(str(file_path))
        pages = len(doc)
        if pages == 0:
            issues.append("Document has 0 pages or empty page tree")
            is_valid = False

        for i, page in enumerate(doc):
            try:
                _ = page.rect
            except Exception as e:
                issues.append(f"Page {i + 1} bounding box error: {e}")
                is_valid = False

        doc.close()
    except Exception as exc:
        is_valid = False
        issues.append(f"Failed to parse PDF catalog: {exc}")

    return {
        "valid": is_valid,
        "issues_found": len(issues),
        "issues": issues,
        "status": "Healthy" if is_valid and not issues else "Needs Repair"
    }
