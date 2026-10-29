import io
import pytest
from fastapi.testclient import TestClient
from app.main import app
from tests.test_pdf_operations import create_sample_pdf

client = TestClient(app)


def test_health_endpoints():
    res = client.get("/healthz")
    assert res.status_code == 200
    assert res.json()["status"] == "ok"

    res_api = client.get("/api/health")
    assert res_api.status_code == 200
    assert res_api.json()["app"] == "Foldora PDF"


def test_tools_catalog():
    res = client.get("/api/tools")
    assert res.status_code == 200
    tools = res.json()
    assert len(tools) >= 50

    # Search query
    res_search = client.get("/api/tools?q=merge")
    assert res_search.status_code == 200
    found = res_search.json()
    assert any(t["id"] == "merge-pdf" for t in found)

    # Tool by id
    res_single = client.get("/api/tools/merge-pdf")
    assert res_single.status_code == 200
    assert res_single.json()["name"] == "Merge PDF"


def test_job_lifecycle_and_download():
    pdf1 = create_sample_pdf(1, "Page 1")
    pdf2 = create_sample_pdf(1, "Page 2")

    with open(pdf1, "rb") as f1, open(pdf2, "rb") as f2:
        res = client.post(
            "/api/jobs",
            data={"tool_id": "merge-pdf", "options": "{}"},
            files=[
                ("files", ("doc1.pdf", f1.read(), "application/pdf")),
                ("files", ("doc2.pdf", f2.read(), "application/pdf"))
            ]
        )

    assert res.status_code == 200
    job_data = res.json()
    job_id = job_data["job_id"]
    token = job_data["download_token"]

    # Poll status (in-memory job runs via BackgroundTasks or immediately in test client)
    res_status = client.get(f"/api/jobs/{job_id}")
    assert res_status.status_code == 200
    status_data = res_status.json()
    assert status_data["id"] == job_id

    # If completed, test download authorization
    if status_data["status"] == "completed":
        # Invalid token must return 403
        res_bad_dl = client.get(f"/api/jobs/{job_id}/download?token=invalid_token")
        assert res_bad_dl.status_code == 403

        # Valid download
        res_good_dl = client.get(f"/api/jobs/{job_id}/download?token={token}")
        assert res_good_dl.status_code == 200
        assert res_good_dl.headers["content-type"] == "application/pdf"
        assert len(res_good_dl.content) > 0

    # Manual cleanup
    res_del = client.delete(f"/api/jobs/{job_id}")
    assert res_del.status_code == 200

    pdf1.unlink(missing_ok=True)
    pdf2.unlink(missing_ok=True)


def test_invalid_tool_rejection():
    res = client.post(
        "/api/jobs",
        data={"tool_id": "nonexistent-tool", "options": "{}"},
        files=[("files", ("test.pdf", b"%PDF-1.4 test content", "application/pdf"))]
    )
    assert res.status_code == 404


def test_preview_endpoint():
    pdf = create_sample_pdf(2, "Preview Test")
    with open(pdf, "rb") as f:
        res = client.post(
            "/api/previews",
            data={"page_index": 0, "max_dim": 400},
            files={"file": ("preview_test.pdf", f.read(), "application/pdf")}
        )
    assert res.status_code == 200
    pdata = res.json()
    assert pdata["total_pages"] == 2
    assert pdata["current_page"] == 1
    assert pdata["image_base64"].startswith("data:image/jpeg;base64,")

    pdf.unlink(missing_ok=True)


def test_spa_static_serving():
    res = client.get("/")
    assert res.status_code == 200
    assert "Foldora PDF" in res.text
    assert "root" in res.text


def test_pdf_info_endpoint():
    pdf = create_sample_pdf(3, "Metadata Info Test")
    with open(pdf, "rb") as f:
        res = client.post(
            "/api/pdf-info",
            files={"file": ("info_test.pdf", f.read(), "application/pdf")}
        )
    assert res.status_code == 200
    data = res.json()
    assert data["total_pages"] == 3
    assert data["is_encrypted"] is False

    pdf.unlink(missing_ok=True)
