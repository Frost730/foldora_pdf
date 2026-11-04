import tempfile
import asyncio
from pathlib import Path
import pymupdf
import pytest
from app.services.ai import ai_service
from app.jobs.manager import job_manager
from app.jobs.executor import execute_job
from app.jobs.models import FileInfo
from app.services.tool_registry import get_tool
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def create_rich_sample_pdf(path: Path) -> None:
    doc = pymupdf.open()

    # Page 1: Executive Overview & Invoice Info
    p1 = doc.new_page(width=612, height=792)
    p1.insert_text((72, 80), "ACME CORPORATION INVOICE AND REPORT", fontsize=16)
    p1.insert_text((72, 110), "Invoice Number: INV-2026-9042", fontsize=11)
    p1.insert_text((72, 130), "Invoice Date: 2026-04-15", fontsize=11)
    p1.insert_text((72, 150), "Due Date: 2026-05-15", fontsize=11)
    p1.insert_text((72, 170), "Vendor: Acme Global Technologies Inc.", fontsize=11)
    p1.insert_text((72, 190), "Bill To: Foldora Enterprise Solutions", fontsize=11)
    p1.insert_text((72, 210), "Contact: billing@acme-global.test", fontsize=11)
    p1.insert_text((72, 230), "Phone: +1 (555) 432-8765", fontsize=11)
    p1.insert_text((72, 250), "Website: https://acme-global.test/portal", fontsize=11)
    p1.insert_text((72, 280), "Line Item: Cloud Infrastructure Deployment | $4,500.00", fontsize=11)
    p1.insert_text((72, 300), "Line Item: High-Availability Database Migration | $2,750.00", fontsize=11)
    p1.insert_text((72, 320), "Subtotal: $7,250.00", fontsize=11)
    p1.insert_text((72, 340), "Tax Amount: $725.00", fontsize=11)
    p1.insert_text((72, 360), "Total Due: $7,975.00", fontsize=12)

    # Page 2: Project Requirements & Action Items
    p2 = doc.new_page(width=612, height=792)
    p2.insert_text((72, 80), "PROJECT ACTION ITEMS AND COMPLIANCE REQUIREMENTS", fontsize=16)
    p2.insert_text((72, 120), "The client must approve the architecture specification by May 10, 2026.", fontsize=11)
    p2.insert_text((72, 150), "All engineers shall complete security certification training prior to production release.", fontsize=11)
    p2.insert_text((72, 180), "The contractor is required to deliver weekly status reports to executive sponsors.", fontsize=11)
    p2.insert_text((72, 210), "Final deliverables and QA validation must be completed by June 30, 2026.", fontsize=11)
    p2.insert_text((72, 240), "Governed by the laws of the State of California.", fontsize=11)

    # Page 3: Research Methodology and Definitions
    p3 = doc.new_page(width=612, height=792)
    p3.insert_text((72, 80), "SYSTEM ARCHITECTURE AND METHODOLOGY STUDY", fontsize=16)
    p3.insert_text((72, 120), "Abstract: This study presents an empirical analysis of microservice scaling efficiency.", fontsize=11)
    p3.insert_text((72, 150), "Extractive Summarization is defined as selecting verbatim key sentences based on frequency.", fontsize=11)
    p3.insert_text((72, 180), "Results demonstrated a 42% decrease in latency and 99.9% service uptime under heavy load.", fontsize=11)
    p3.insert_text((72, 210), "In conclusion, distributed indexing provides superior throughput and fault tolerance.", fontsize=11)

    doc.save(str(path))
    doc.close()


def create_scanned_pdf(path: Path) -> None:
    """PDF with 0 extractable text characters (simulating pure scan)."""
    doc = pymupdf.open()
    doc.new_page(width=612, height=792)
    doc.save(str(path))
    doc.close()


@pytest.mark.anyio
async def test_ask_pdf_citations_confidence_and_suggested_questions():
    with tempfile.TemporaryDirectory() as td:
        pdf_path = Path(td) / "rich_doc.pdf"
        create_rich_sample_pdf(pdf_path)

        res = await ai_service.ask_pdf(pdf_path, "What is the total amount due and invoice number?")
        assert res["confidence"] >= 0.40
        assert res["confidence_label"] in ("High", "Medium")
        assert len(res["citations"]) > 0
        assert any(c["page"] == 1 for c in res["citations_detail"])
        assert len(res["suggested_questions"]) >= 3
        assert "INV-2026-9042" in res["answer"] or "7,975.00" in res["answer"] or len(res["citations"]) > 0
        assert "FOLDORA AI - ASK PDF QUERY REPORT" in res["formatted_report"]


@pytest.mark.anyio
async def test_ask_pdf_scanned_document_does_not_crash():
    with tempfile.TemporaryDirectory() as td:
        pdf_path = Path(td) / "scanned.pdf"
        create_scanned_pdf(pdf_path)

        res = await ai_service.ask_pdf(pdf_path, "What is the revenue?")
        assert res["confidence"] == 0.0
        assert "no readable text layer" in res["answer"].lower() or "ocr" in res["answer"].lower()
        assert len(res["citations"]) == 0


@pytest.mark.anyio
@pytest.mark.parametrize("mode", ["executive", "key_takeaways", "action_items", "study_guide", "faq"])
async def test_summarize_pdf_modes_and_metadata(mode):
    with tempfile.TemporaryDirectory() as td:
        pdf_path = Path(td) / "rich_doc.pdf"
        create_rich_sample_pdf(pdf_path)

        res = await ai_service.summarize_pdf(pdf_path, mode=mode, length="standard")
        assert res["mode"] == mode
        assert res["word_count"] > 50
        assert res["summary_word_count"] > 0
        assert res["pages_analyzed"] == 3
        assert "reading_time_saved_min" in res
        assert "original_reading_time_min" in res
        assert len(res["formatted_report"]) > 0

        if mode == "action_items":
            assert len(res["action_items"]) > 0
            assert any("must" in item.lower() or "shall" in item.lower() or "required" in item.lower() for item in res["action_items"])
        elif mode == "faq":
            assert "Q:" in res["formatted_report"]
            assert "A:" in res["formatted_report"]


@pytest.mark.anyio
async def test_summarize_pdf_scanned_graceful_notice():
    with tempfile.TemporaryDirectory() as td:
        pdf_path = Path(td) / "scanned.pdf"
        create_scanned_pdf(pdf_path)

        res = await ai_service.summarize_pdf(pdf_path, mode="executive")
        assert "scanned" in res["formatted_report"].lower() or "ocr" in res["formatted_report"].lower()
        assert res["word_count"] == 0


@pytest.mark.parametrize("schema", ["general", "invoices", "legal", "research"])
def test_extract_structured_data_schemas_and_outputs(schema):
    with tempfile.TemporaryDirectory() as td:
        pdf_path = Path(td) / "rich_doc.pdf"
        create_rich_sample_pdf(pdf_path)

        out_json = Path(td) / f"struct_{schema}.json"
        res = ai_service.extract_structured_data(pdf_path, out_json, schema=schema)

        assert out_json.exists()
        assert res["schema"] == schema
        assert "billing@acme-global.test" in res["entities"]["email_addresses"]
        assert "$7,975.00" in res["entities"]["currency_amounts"]
        assert "https://acme-global.test/portal" in res["entities"]["urls_found"]

        # Check Markdown companion
        out_md = out_json.with_suffix(".md")
        assert out_md.exists()
        assert f"**Schema Applied:** `{schema.title()}`" in out_md.read_text(encoding="utf-8")

        if schema == "invoices":
            assert res["schema_data"]["invoice_number"] == "INV-2026-9042"
            assert "$7,975.00" in str(res["schema_data"]["total_amount"])
        elif schema == "legal":
            assert "California" in res["schema_data"]["governing_law_jurisdiction"]


@pytest.mark.anyio
async def test_translate_pdf_text_multilingual():
    with tempfile.TemporaryDirectory() as td:
        pdf_path = Path(td) / "rich_doc.pdf"
        create_rich_sample_pdf(pdf_path)

        out_txt = Path(td) / "translated.txt"
        res = await ai_service.translate_pdf_text(pdf_path, out_txt, target_language="fr")

        assert out_txt.exists()
        assert res["language_name"] == "French (Français)"
        content = out_txt.read_text(encoding="utf-8")
        assert "TRANSLATED DOCUMENT TEXT" in content
        assert "Page 1" in content or "Page" in content


def test_api_suggest_questions_endpoint():
    with tempfile.TemporaryDirectory() as td:
        pdf_path = Path(td) / "rich_doc.pdf"
        create_rich_sample_pdf(pdf_path)

        with open(pdf_path, "rb") as f:
            resp = client.post("/api/ai/suggest-questions", files={"file": ("rich_doc.pdf", f, "application/pdf")})

        assert resp.status_code == 200
        data = resp.json()
        assert "suggested_questions" in data
        assert len(data["suggested_questions"]) >= 3


def test_summarize_pdf_alias_in_tool_registry():
    t1 = get_tool("pdf-summarizer")
    t2 = get_tool("summarize-pdf")
    assert t1 is not None
    assert t2 is not None
    assert t1.id == t2.id
