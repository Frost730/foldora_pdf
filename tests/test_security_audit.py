import io
import tempfile
import zipfile
from pathlib import Path
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.core.security import (
    validate_job_id,
    sanitize_filename,
    is_safe_url,
    sanitize_html_content,
    run_safe_command,
    sniff_file_type
)
from app.utils.file_utils import (
    get_job_dir,
    cleanup_directory,
    validate_zip_bomb,
    safe_extract_zip
)
from tests.test_pdf_operations import create_sample_pdf

client = TestClient(app)


def test_job_id_validation_and_path_traversal():
    """Verify that malicious job IDs are strictly rejected."""
    traversal_ids = [
        "../etc/passwd",
        "..\\windows\\win.ini",
        "job_12345/subdir",
        "job_12345\\subdir",
        "job_!@#$%",
        "job_1234\0null",
        "",
        "short",
        "a" * 100
    ]
    for bad_id in traversal_ids:
        with pytest.raises(ValueError):
            validate_job_id(bad_id)

    # API endpoints reject invalid job IDs with 400, 404, or 405
    res_status = client.get("/api/jobs/../invalid")
    assert res_status.status_code in (400, 404, 405)

    res_cancel = client.post("/api/jobs/..%2f..%2fetc/cancel")
    assert res_cancel.status_code in (400, 404, 405)

    res_dl = client.get("/api/jobs/../download?token=some_token")
    assert res_dl.status_code in (400, 404, 405)

    # Test direct bad id format
    res_direct_bad = client.get("/api/jobs/invalid_id!@#")
    assert res_direct_bad.status_code == 400


def test_filename_sanitization_and_windows_device_names():
    """Verify filename sanitization strips paths, null bytes, and Windows device names."""
    assert sanitize_filename("../../malicious.pdf") == "malicious.pdf"
    assert sanitize_filename("..\\..\\malicious.pdf") == "malicious.pdf"
    assert sanitize_filename("/etc/shadow") == "shadow"
    assert sanitize_filename("foo\0bar.pdf") == "foobar.pdf"
    assert sanitize_filename("CON.txt").startswith("doc_CON_")
    assert sanitize_filename("nul.pdf").startswith("doc_nul_")
    assert sanitize_filename("PRN").startswith("doc_PRN_")
    assert sanitize_filename("..") != ".."
    assert not sanitize_filename("   ").startswith(" ")


def test_ssrf_url_validation():
    """Verify that is_safe_url blocks private, link-local, loopback, and metadata IPs."""
    # Forbidden targets
    unsafe_urls = [
        "http://127.0.0.1/admin",
        "http://localhost:8080/secret",
        "http://0.0.0.0/",
        "http://169.254.169.254/latest/meta-data/",
        "http://10.0.0.1/",
        "http://192.168.1.100/router",
        "http://172.16.0.5/",
        "http://[::1]/",
        "ftp://example.com/file",
        "file:///etc/passwd",
        "gopher://127.0.0.1:70/",
        "http://metadata.google.internal/computeMetadata/v1/"
    ]
    for u in unsafe_urls:
        safe, reason = is_safe_url(u)
        assert not safe, f"Expected {u} to be blocked, but passed: {reason}"

    # Safe external URLs
    safe, reason = is_safe_url("https://www.example.com/api")
    assert safe, f"Expected safe URL to pass, got: {reason}"


def test_html_sanitization_xxe_and_script_strip():
    """Verify HTML sanitization strips scripts, iframes, and XXE declarations."""
    malicious_html = """
    <!DOCTYPE foo [ <!ENTITY xxe SYSTEM "file:///etc/passwd"> ]>
    <html>
      <head>
        <script>alert('XSS')</script>
        <link rel="stylesheet" href="http://127.0.0.1/evil.css">
      </head>
      <body onload="alert('pwned')">
        <iframe src="http://169.254.169.254/latest/meta-data/"></iframe>
        <a href="javascript:alert(1)">Click</a>
        <h1>Hello World</h1>
      </body>
    </html>
    """
    cleaned = sanitize_html_content(malicious_html)
    low = cleaned.lower()
    assert "<script" not in low
    assert "<iframe" not in low
    assert "onload" not in low
    assert "javascript:" not in low
    assert "<!entity" not in low
    assert "Hello World" in cleaned


def test_zip_bomb_detection():
    """Verify that zip bomb detector raises ValueError for high-ratio archives."""
    with tempfile.NamedTemporaryFile(suffix=".zip", delete=False) as tf:
        zip_path = Path(tf.name)

    try:
        # Create a mock zip bomb: 100MB of zeroes compressed into few bytes
        with zipfile.ZipFile(zip_path, "w", compression=zipfile.ZIP_DEFLATED) as zf:
            large_zeroes = b"\x00" * (15 * 1024 * 1024)
            zf.writestr("bomb.txt", large_zeroes)

        # Testing with a low ratio threshold
        with pytest.raises(ValueError, match="Decompression bomb detected"):
            validate_zip_bomb(zip_path, max_ratio=5.0, max_uncompressed_bytes=5 * 1024 * 1024)
    finally:
        zip_path.unlink(missing_ok=True)


def test_zip_slip_prevention():
    """Verify that safe_extract_zip prevents extraction outside of target directory."""
    with tempfile.TemporaryDirectory() as td:
        target_dir = Path(td) / "extract_dest"
        target_dir.mkdir()
        zip_file = Path(td) / "slip.zip"

        with zipfile.ZipFile(zip_file, "w") as zf:
            zf.writestr("../evil.txt", "escaped content")

        with pytest.raises(ValueError, match="Zip Slip"):
            safe_extract_zip(zip_file, target_dir)


def test_upload_extension_and_magic_byte_enforcement():
    """Verify that uploading invalid extensions or spoofed extensions is rejected."""
    # 1. Disallowed extension
    res = client.post(
        "/api/jobs",
        data={"tool_id": "merge-pdf", "options": "{}"},
        files=[("files", ("malicious.exe", b"MZ\x90\x00executable", "application/x-msdownload"))]
    )
    assert res.status_code == 400
    assert "not accepted" in res.json()["detail"].lower()

    # 2. Extension claims .pdf, but file content is not PDF (magic bytes mismatch)
    res_fake = client.post(
        "/api/jobs",
        data={"tool_id": "merge-pdf", "options": "{}"},
        files=[("files", ("fake.pdf", b"NOT_A_PDF_CONTENT_HERE", "application/pdf"))]
    )
    assert res_fake.status_code == 400
    assert "not a valid pdf" in res_fake.json()["detail"].lower()


def test_download_security_headers_and_traversal():
    """Verify that downloads include strict security headers and block path traversal."""
    pdf = create_sample_pdf(1, "Secure Download Test")
    with open(pdf, "rb") as f:
        res = client.post(
            "/api/jobs",
            data={"tool_id": "merge-pdf", "options": "{}"},
            files=[("files", ("secure.pdf", f.read(), "application/pdf"))]
        )
    assert res.status_code == 200
    job_id = res.json()["job_id"]
    token = res.json()["download_token"]

    status = client.get(f"/api/jobs/{job_id}").json()
    if status["status"] == "completed":
        # Check download security headers
        dl_res = client.get(f"/api/jobs/{job_id}/download?token={token}")
        assert dl_res.status_code == 200
        assert dl_res.headers.get("x-content-type-options") == "nosniff"
        assert "default-src 'none'" in dl_res.headers.get("content-security-policy", "")
        assert "attachment" in dl_res.headers.get("content-disposition", "")

        # Request non-existent file_id should return 404
        dl_bad_file = client.get(f"/api/jobs/{job_id}/download?token={token}&file_id=nonexistent.pdf")
        assert dl_bad_file.status_code == 404

        # Request file_id with path traversal should return 404 or 400
        dl_trav = client.get(f"/api/jobs/{job_id}/download?token={token}&file_id=../../windows/win.ini")
        assert dl_trav.status_code in (400, 404)

    # Cleanup
    client.delete(f"/api/jobs/{job_id}")
    pdf.unlink(missing_ok=True)


def test_spa_path_traversal_blocked():
    """Verify that SPA route /... strictly blocks traversal out of dist/."""
    res = client.get("/../../../../etc/passwd")
    # Must either 404 or serve index.html (fallback SPA), but NEVER leak arbitrary system files
    if res.status_code == 200:
        assert "<html" in res.text or "<!DOCTYPE html" in res.text
        assert "root:" not in res.text
        assert "[extensions]" not in res.text


def test_windows_device_names_with_multiple_extensions():
    """Verify that multi-extension Windows device names like CON.tar.gz are sanitized."""
    assert sanitize_filename("CON.tar.gz").startswith("doc_CON")
    assert sanitize_filename("aux.backup.pdf").startswith("doc_aux")
    assert sanitize_filename("nul.123").startswith("doc_nul_")
    assert sanitize_filename("com1.txt").startswith("doc_com1_")


def test_html_sanitization_advanced_xxe_and_nested_tags():
    """Verify that advanced XXE without brackets, XML declarations, and nested tags are neutralized."""
    # 1. DOCTYPE with SYSTEM without internal brackets
    xxe_html = '<!DOCTYPE root SYSTEM "file:///etc/passwd"><html><body>Secret</body></html>'
    cleaned = sanitize_html_content(xxe_html)
    assert "file:///etc/passwd" not in cleaned
    assert "SYSTEM" not in cleaned

    # 2. XML declarations
    xml_decl_html = '<?xml version="1.0"?><?xml-stylesheet href="evil.xsl"?><html><body>Text</body></html>'
    cleaned_xml = sanitize_html_content(xml_decl_html)
    assert "<?xml" not in cleaned_xml

    # 3. Nested tags designed to bypass single-pass regex
    nested_html = '<scr<script>ipt>alert(1)</script>'
    cleaned_nested = sanitize_html_content(nested_html)
    assert "<script" not in cleaned_nested.lower()

    # 4. xlink:href scheme
    xlink_html = '<svg><a xlink:href="javascript:alert(1)"><text>Click</text></a></svg>'
    cleaned_xlink = sanitize_html_content(xlink_html)
    assert "javascript:" not in cleaned_xlink


def test_html_to_pdf_ssrf_blocking():
    """Verify that html_to_pdf blocks HTML referencing private IPs and SSRF targets."""
    from app.services.conversion.convert_to_pdf import html_to_pdf

    with tempfile.TemporaryDirectory() as td:
        html_file = Path(td) / "test.html"
        out_pdf = Path(td) / "out.pdf"

        # HTML referencing RFC 1918 private IP
        html_file.write_text('<p><img src="http://192.168.1.100/secret.png"></p>', encoding="utf-8")
        with pytest.raises(ValueError, match="prohibited"):
            html_to_pdf(html_file, out_pdf)

        # HTML referencing loopback
        html_file.write_text('<p><img src="http://127.0.0.1:8000/secret.png"></p>', encoding="utf-8")
        with pytest.raises(ValueError, match="prohibited"):
            html_to_pdf(html_file, out_pdf)

        # HTML referencing prohibited local path
        html_file.write_text('<p><img src="/etc/passwd"></p>', encoding="utf-8")
        with pytest.raises(ValueError, match="prohibited"):
            html_to_pdf(html_file, out_pdf)


def test_magic_byte_enforcement_for_images_and_office():
    """Verify that uploading fake image or office files is rejected."""
    # 1. Fake PNG
    res_png = client.post(
        "/api/jobs",
        data={"tool_id": "png-to-pdf", "options": "{}"},
        files=[("files", ("fake.png", b"NOT_A_PNG_BINARY", "image/png"))]
    )
    assert res_png.status_code == 400
    assert "not a valid png" in res_png.json()["detail"].lower()

    # 2. Fake DOCX
    res_docx = client.post(
        "/api/jobs",
        data={"tool_id": "word-to-pdf", "options": "{}"},
        files=[("files", ("fake.docx", b"NOT_A_ZIP_OFFICE", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"))]
    )
    assert res_docx.status_code == 400
    assert "not a valid office" in res_docx.json()["detail"].lower()


def test_office_archive_xxe_detection():
    """Verify that validate_zip_bomb detects embedded XXE inside Office XML files."""
    with tempfile.NamedTemporaryFile(suffix=".docx", delete=False) as tf:
        docx_path = Path(tf.name)

    try:
        with zipfile.ZipFile(docx_path, "w") as zf:
            xxe_xml = '<!DOCTYPE doc [ <!ENTITY xxe SYSTEM "file:///etc/passwd"> ]><root>&xxe;</root>'
            zf.writestr("word/document.xml", xxe_xml)

        with pytest.raises(ValueError, match="XXE payload detected"):
            validate_zip_bomb(docx_path)
    finally:
        docx_path.unlink(missing_ok=True)


def test_non_existent_job_does_not_create_directory_dos():
    """Verify querying or deleting non-existent jobs does not create folders on disk."""
    from app.core.config import settings

    fake_id = "job_0123456789abcdef0123456789abcdef"
    expected_dir = settings.storage_path / fake_id

    # Ensure it doesn't exist before
    assert not expected_dir.exists()

    # GET status of non-existent job
    res = client.get(f"/api/jobs/{fake_id}")
    assert res.status_code == 404

    # Verify no directory was created on disk
    assert not expected_dir.exists(), "Directory was created on disk for non-existent job ID!"

    # DELETE non-existent job
    res_del = client.delete(f"/api/jobs/{fake_id}")
    assert res_del.status_code == 404
    assert not expected_dir.exists(), "Directory was created during delete of non-existent job ID!"


def test_ssrf_dangerous_ports_blocked():
    """Verify that dangerous ports (22, 25, 6379, etc.) are blocked even on public domains."""
    safe, reason = is_safe_url("http://93.184.216.34:22/")
    assert not safe
    assert "Prohibited port" in reason

    safe, reason = is_safe_url("http://93.184.216.34:6379/")
    assert not safe
    assert "Prohibited port" in reason

