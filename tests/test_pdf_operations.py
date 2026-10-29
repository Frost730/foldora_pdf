import io
import shutil
import tempfile
from pathlib import Path
import pytest
import pymupdf
from PIL import Image

from app.services.pdf import organize
from app.services.compression import compress
from app.services.conversion import convert_to_pdf, convert_from_pdf
from app.services.editing import editor
from app.services.security import security_service
from app.services.ai import ai_service


def create_sample_pdf(num_pages: int = 3, sample_text: str = "Foldora Test Document") -> Path:
    """Helper to generate a temporary test PDF."""
    temp_file = Path(tempfile.NamedTemporaryFile(suffix=".pdf", delete=False).name)
    doc = pymupdf.open()
    for i in range(num_pages):
        page = doc.new_page(width=595, height=842)
        page.insert_text(pymupdf.Point(72, 100), f"{sample_text} - Page {i + 1}", fontsize=14)
        page.insert_text(pymupdf.Point(72, 140), "Confidential Secret Keyword 12345", fontsize=12)
    doc.save(str(temp_file))
    doc.close()
    return temp_file


def create_sample_image() -> Path:
    """Helper to generate a temporary test image."""
    temp_file = Path(tempfile.NamedTemporaryFile(suffix=".png", delete=False).name)
    img = Image.new("RGB", (400, 300), color=(73, 109, 137))
    img.save(temp_file)
    return temp_file


def test_merge_pdfs():
    pdf1 = create_sample_pdf(2, "Doc 1")
    pdf2 = create_sample_pdf(2, "Doc 2")
    out = Path(tempfile.NamedTemporaryFile(suffix=".pdf", delete=False).name)

    organize.merge_pdfs([pdf1, pdf2], out)

    doc = pymupdf.open(str(out))
    assert len(doc) == 4
    doc.close()

    pdf1.unlink(missing_ok=True)
    pdf2.unlink(missing_ok=True)
    out.unlink(missing_ok=True)


def test_split_pdf():
    pdf = create_sample_pdf(4, "Split Doc")
    out_dir = Path(tempfile.mkdtemp())

    parts = organize.split_pdf(pdf, out_dir, mode="each_page")
    assert len(parts) == 4
    for p in parts:
        assert p.exists()
        d = pymupdf.open(str(p))
        assert len(d) == 1
        d.close()

    pdf.unlink(missing_ok=True)
    shutil.rmtree(out_dir, ignore_errors=True)


def test_remove_and_rotate_pages():
    pdf = create_sample_pdf(3, "Manipulate Doc")
    out_removed = Path(tempfile.NamedTemporaryFile(suffix=".pdf", delete=False).name)
    out_rotated = Path(tempfile.NamedTemporaryFile(suffix=".pdf", delete=False).name)

    organize.remove_pages(pdf, out_removed, pages_to_remove_str="2")
    doc = pymupdf.open(str(out_removed))
    assert len(doc) == 2
    doc.close()

    organize.rotate_pdf(out_removed, out_rotated, angle=90)
    doc_rot = pymupdf.open(str(out_rotated))
    assert doc_rot[0].rotation == 90
    doc_rot.close()

    pdf.unlink(missing_ok=True)
    out_removed.unlink(missing_ok=True)
    out_rotated.unlink(missing_ok=True)


def test_page_numbers_and_watermark():
    pdf = create_sample_pdf(2, "Watermark Doc")
    out_num = Path(tempfile.NamedTemporaryFile(suffix=".pdf", delete=False).name)
    out_wm = Path(tempfile.NamedTemporaryFile(suffix=".pdf", delete=False).name)

    organize.add_page_numbers(pdf, out_num, position="bottom_center", format_str="Page {n} of {total}")
    doc = pymupdf.open(str(out_num))
    assert "Page 1 of 2" in doc[0].get_text("text")
    doc.close()

    editor.add_watermark(pdf, out_wm, text="DRAFT")
    doc_wm = pymupdf.open(str(out_wm))
    assert "DRAFT" in doc_wm[0].get_text("text")
    doc_wm.close()

    pdf.unlink(missing_ok=True)
    out_num.unlink(missing_ok=True)
    out_wm.unlink(missing_ok=True)


def test_compression_logic():
    pdf = create_sample_pdf(3, "Compress Doc")
    out_comp = Path(tempfile.NamedTemporaryFile(suffix=".pdf", delete=False).name)

    res = compress.compress_pdf(pdf, out_comp, preset="recommended")
    assert "original_size" in res
    assert "compressed_size" in res
    assert out_comp.exists()
    assert out_comp.stat().st_size > 0

    pdf.unlink(missing_ok=True)
    out_comp.unlink(missing_ok=True)


def test_image_conversion_roundtrip():
    img_path = create_sample_image()
    pdf_out = Path(tempfile.NamedTemporaryFile(suffix=".pdf", delete=False).name)
    convert_to_pdf.images_to_pdf([img_path], pdf_out)

    doc = pymupdf.open(str(pdf_out))
    assert len(doc) == 1
    doc.close()

    img_dir = Path(tempfile.mkdtemp())
    exported_imgs = convert_from_pdf.pdf_to_images(pdf_out, img_dir, img_format="png")
    assert len(exported_imgs) == 1
    assert exported_imgs[0].exists()

    img_path.unlink(missing_ok=True)
    pdf_out.unlink(missing_ok=True)
    shutil.rmtree(img_dir, ignore_errors=True)


def test_pdf_to_docx_and_text():
    pdf = create_sample_pdf(2, "Docx Conversion Test")
    docx_out = Path(tempfile.NamedTemporaryFile(suffix=".docx", delete=False).name)
    txt_out = Path(tempfile.NamedTemporaryFile(suffix=".txt", delete=False).name)

    convert_from_pdf.pdf_to_docx(pdf, docx_out)
    assert docx_out.exists()
    assert docx_out.stat().st_size > 0

    convert_from_pdf.pdf_to_txt(pdf, txt_out)
    with open(txt_out, "r", encoding="utf-8") as f:
        content = f.read()
    assert "Docx Conversion Test" in content

    pdf.unlink(missing_ok=True)
    docx_out.unlink(missing_ok=True)
    txt_out.unlink(missing_ok=True)


def test_protect_and_unlock_pdf():
    pdf = create_sample_pdf(2, "Secret Document")
    protected_out = Path(tempfile.NamedTemporaryFile(suffix=".pdf", delete=False).name)
    unlocked_out = Path(tempfile.NamedTemporaryFile(suffix=".pdf", delete=False).name)

    # Protect with password
    security_service.protect_pdf(pdf, protected_out, user_password="Pass1234Secure")
    doc_enc = pymupdf.open(str(protected_out))
    assert doc_enc.is_encrypted
    doc_enc.close()

    # Attempt unlock with wrong password -> should raise error
    with pytest.raises(ValueError):
        security_service.unlock_pdf(protected_out, unlocked_out, password="WrongPassword")

    # Unlock with valid password
    security_service.unlock_pdf(protected_out, unlocked_out, password="Pass1234Secure")
    doc_dec = pymupdf.open(str(unlocked_out))
    assert not doc_dec.is_encrypted
    assert len(doc_dec) == 2
    doc_dec.close()

    pdf.unlink(missing_ok=True)
    protected_out.unlink(missing_ok=True)
    unlocked_out.unlink(missing_ok=True)


def test_redact_pdf_scrubs_bytes():
    pdf = create_sample_pdf(2, "Redaction Target")
    redacted_out = Path(tempfile.NamedTemporaryFile(suffix=".pdf", delete=False).name)

    res = security_service.redact_pdf(pdf, redacted_out, search_keywords=["Confidential Secret Keyword 12345"])
    assert res["success"] is True
    assert res["verified_sanitized"] is True

    # Validate that the sensitive keyword cannot be found in the text layer
    doc = pymupdf.open(str(redacted_out))
    found = False
    for page in doc:
        if page.search_for("Confidential Secret Keyword 12345"):
            found = True
    doc.close()
    assert not found

    pdf.unlink(missing_ok=True)
    redacted_out.unlink(missing_ok=True)


def test_metadata_removal():
    pdf = create_sample_pdf(1, "Metadata Document")
    doc = pymupdf.open(str(pdf))
    doc.set_metadata({"author": "Secret User", "title": "Top Secret"})
    pdf_with_meta = Path(tempfile.NamedTemporaryFile(suffix=".pdf", delete=False).name)
    doc.save(str(pdf_with_meta))
    doc.close()

    out = Path(tempfile.NamedTemporaryFile(suffix=".pdf", delete=False).name)
    security_service.remove_metadata(pdf_with_meta, out)

    doc_clean = pymupdf.open(str(out))
    meta = doc_clean.metadata
    assert meta.get("author") == ""
    assert meta.get("title") == ""
    doc_clean.close()

    pdf.unlink(missing_ok=True)
    pdf_with_meta.unlink(missing_ok=True)
    out.unlink(missing_ok=True)


def test_compare_pdfs():
    pdf1 = create_sample_pdf(2, "First Version")
    pdf2 = create_sample_pdf(2, "Second Version Changed")
    report = Path(tempfile.NamedTemporaryFile(suffix=".txt", delete=False).name)

    res = security_service.compare_pdfs(pdf1, pdf2, report)
    assert res["identical"] is False
    assert res["additions"] > 0
    assert report.exists()

    pdf1.unlink(missing_ok=True)
    pdf2.unlink(missing_ok=True)
    report.unlink(missing_ok=True)


def test_ai_extractive_summary_and_structured_data():
    pdf = create_sample_pdf(2, "Foldora AI Document Analysis. Total Due: $1,250.00. Email: contact@foldora.test.")
    out_json = Path(tempfile.NamedTemporaryFile(suffix=".json", delete=False).name)

    struct_res = ai_service.extract_structured_data(pdf, out_json)
    assert "contact@foldora.test" in struct_res["entities"]["email_addresses"]
    assert "$1,250.00" in struct_res["entities"]["currency_amounts"]

    pdf.unlink(missing_ok=True)
    out_json.unlink(missing_ok=True)


def test_replace_text_in_pdf():
    pdf = create_sample_pdf(2, "Original Text To Replace")
    out = Path(tempfile.NamedTemporaryFile(suffix=".pdf", delete=False).name)

    res = editor.replace_text_in_pdf(pdf, out, find_text="Original Text To Replace", replace_text="Foldora Replaced Text")
    assert res["success"] is True
    assert res["replacements_count"] > 0

    doc = pymupdf.open(str(out))
    found_new = False
    found_old = False
    for page in doc:
        if page.search_for("Foldora Replaced Text"):
            found_new = True
        if page.search_for("Original Text To Replace"):
            found_old = True
    doc.close()

    assert found_new is True
    assert found_old is False

    pdf.unlink(missing_ok=True)
    out.unlink(missing_ok=True)


def test_apply_visual_edits():
    pdf = create_sample_pdf(2, "Contract Agreement Between Parties")
    out = Path(tempfile.NamedTemporaryFile(suffix=".pdf", delete=False).name)

    edits = [
        {
            "type": "replace_text",
            "page": 1,
            "find_text": "Contract Agreement",
            "replace_text": "Modified Terms",
            "bbox": [50.0, 50.0, 250.0, 100.0],
            "size": 14.0,
            "color": "#2563eb"
        },
        {
            "type": "add_text",
            "page": 1,
            "text": "APPROVED VISUAL STAMP",
            "x": 72.0,
            "y": 200.0,
            "size": 16.0,
            "color": "#059669",
            "is_bold": True
        },
        {
            "type": "drawing",
            "page": 1,
            "points": [[100.0, 350.0], [150.0, 370.0], [200.0, 350.0]],
            "stroke_color": "#dc2626",
            "stroke_width": 2.5
        },
        {
            "type": "highlight",
            "page": 1,
            "x": 72.0,
            "y": 420.0,
            "w": 120.0,
            "h": 20.0,
            "color": "#facc15"
        },
        {
            "type": "line",
            "page": 1,
            "x": 72.0,
            "y": 480.0,
            "w": 100.0,
            "h": 0.0,
            "is_arrow": True,
            "stroke_color": "#059669"
        },
        {
            "type": "stamp",
            "page": 1,
            "text": "VERIFIED",
            "color": "#dc2626",
            "x": 100.0,
            "y": 520.0,
            "w": 130.0,
            "h": 40.0
        },
        {
            "type": "whiteout",
            "page": 1,
            "x": 72.0,
            "y": 300.0,
            "w": 100.0,
            "h": 20.0
        }
    ]

    res = editor.apply_visual_edits(pdf, out, edits)
    assert res["success"] is True
    assert res["applied_edits_count"] >= 5
    assert out.exists()

    doc = pymupdf.open(str(out))
    assert len(doc) == 2
    page1_text = doc[0].get_text()
    assert "Modified Terms" in page1_text
    assert "APPROVED VISUAL STAMP" in page1_text
    assert "VERIFIED" in page1_text
    doc.close()

    pdf.unlink(missing_ok=True)
    out.unlink(missing_ok=True)
