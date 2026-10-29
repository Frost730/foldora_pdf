import asyncio
import json
import logging
from pathlib import Path
from typing import List, Tuple, Dict, Any
from app.core.config import settings
from app.jobs.models import JobStatus, OutputFile
from app.jobs.manager import job_manager
from app.utils.file_utils import get_job_dir, create_zip_archive
from app.services.tool_registry import get_tool

# Import all service functions
from app.services.pdf import organize
from app.services.compression import compress
from app.services.ocr import ocr_service
from app.services.conversion import convert_to_pdf, convert_from_pdf
from app.services.editing import editor
from app.services.security import security_service
from app.services.ai import ai_service

logger = logging.getLogger("foldora.executor")


async def execute_job(job_id: str) -> None:
    """Asynchronous background execution of a PDF job."""
    job = job_manager.get_job(job_id)
    if not job:
        logger.error("Cannot execute non-existent job: %s", job_id)
        return

    job_dir = get_job_dir(job_id)
    def _file_id(f):
        return f.file_id if hasattr(f, "file_id") else f["file_id"]
    input_paths = [job_dir / _file_id(f) for f in job.input_files]

    await job_manager.acquire_slot()
    try:
        # Check if cancelled before starting
        if job.status == JobStatus.CANCELLED:
            return

        job_manager.update_job(
            job_id,
            status=JobStatus.PROCESSING,
            progress=15,
            message="Processing document..."
        )

        tool_id = job.tool_id
        opts = job.options or {}
        output_files: List[OutputFile] = []
        meta_update: Dict[str, Any] = {}

        # -------------------------------------------------------------
        # Category A: Organize PDF
        # -------------------------------------------------------------
        if tool_id == "merge-pdf":
            out_p = job_dir / "merged_document.pdf"
            organize.merge_pdfs(input_paths, out_p)
            output_files.append(_make_output_file(job_id, job.download_token, out_p, "merged_document.pdf", "application/pdf"))

        elif tool_id == "split-pdf":
            split_dir = job_dir / "split_output"
            split_dir.mkdir(exist_ok=True)
            mode = opts.get("mode", "ranges")
            ranges_str = opts.get("ranges", "1")
            pages_per_doc = int(opts.get("pages_per_doc", 1))

            parts = organize.split_pdf(input_paths[0], split_dir, mode=mode, ranges_str=ranges_str, pages_per_doc=pages_per_doc)
            output_files = _package_multiple_or_single(job_id, job.download_token, parts, job_dir, "split_documents.zip")

        elif tool_id == "organize-pdf":
            out_p = job_dir / "organized_document.pdf"
            page_order = opts.get("page_order", [])
            organize.organize_pdf(input_paths[0], out_p, page_order)
            output_files.append(_make_output_file(job_id, job.download_token, out_p, "organized_document.pdf", "application/pdf"))

        elif tool_id == "extract-pages":
            ext_dir = job_dir / "extracted_pages"
            ext_dir.mkdir(exist_ok=True)
            pages_str = opts.get("pages", "1")
            as_single = bool(opts.get("as_single_file", True))
            extracted = organize.extract_pages(input_paths[0], ext_dir, pages_str, as_single_file=as_single)
            output_files = _package_multiple_or_single(job_id, job.download_token, extracted, job_dir, "extracted_pages.zip")

        elif tool_id == "remove-pages":
            out_p = job_dir / "pages_removed.pdf"
            pages_to_remove = opts.get("pages_to_remove", "1")
            organize.remove_pages(input_paths[0], out_p, pages_to_remove)
            output_files.append(_make_output_file(job_id, job.download_token, out_p, "pages_removed.pdf", "application/pdf"))

        elif tool_id == "rotate-pdf":
            out_p = job_dir / "rotated_document.pdf"
            angle = int(opts.get("angle", 90))
            page_indices = opts.get("pages", "")
            organize.rotate_pdf(input_paths[0], out_p, angle=angle, page_indices_str=page_indices)
            output_files.append(_make_output_file(job_id, job.download_token, out_p, "rotated_document.pdf", "application/pdf"))

        elif tool_id == "add-page-numbers":
            out_p = job_dir / "numbered_document.pdf"
            pos = opts.get("position", "bottom_center")
            fmt = opts.get("format", "Page {n} of {total}")
            start_n = int(opts.get("start_num", 1))
            fsize = float(opts.get("font_size", 10))
            margin = float(opts.get("margin", 36))
            exclude = opts.get("exclude_pages", "")
            organize.add_page_numbers(input_paths[0], out_p, position=pos, format_str=fmt, start_num=start_n, font_size=fsize, margin_pt=margin, exclude_pages_str=exclude)
            output_files.append(_make_output_file(job_id, job.download_token, out_p, "numbered_document.pdf", "application/pdf"))

        elif tool_id == "crop-pdf":
            out_p = job_dir / "cropped_document.pdf"
            t = float(opts.get("top", 0))
            b = float(opts.get("bottom", 0))
            l = float(opts.get("left", 0))
            r = float(opts.get("right", 0))
            pages = opts.get("pages", "")
            organize.crop_pdf(input_paths[0], out_p, top=t, bottom=b, left=l, right=r, page_indices_str=pages)
            output_files.append(_make_output_file(job_id, job.download_token, out_p, "cropped_document.pdf", "application/pdf"))

        # -------------------------------------------------------------
        # Category B: Compress, optimize, and repair
        # -------------------------------------------------------------
        elif tool_id == "compress-pdf":
            out_p = job_dir / "compressed_document.pdf"
            preset = opts.get("preset", "recommended")
            metrics = compress.compress_pdf(input_paths[0], out_p, preset=preset)
            meta_update.update(metrics)
            output_files.append(_make_output_file(job_id, job.download_token, out_p, "compressed_document.pdf", "application/pdf"))

        elif tool_id == "repair-pdf":
            out_p = job_dir / "repaired_document.pdf"
            rep_res = compress.repair_pdf(input_paths[0], out_p)
            meta_update.update(rep_res)
            output_files.append(_make_output_file(job_id, job.download_token, out_p, "repaired_document.pdf", "application/pdf"))

        elif tool_id == "ocr-pdf":
            out_p = job_dir / "searchable_ocr_document.pdf"
            lang = opts.get("language", "eng")
            force = bool(opts.get("force_ocr", False))
            ocr_res = ocr_service.ocr_pdf(input_paths[0], out_p, language=lang, force_ocr=force)
            meta_update.update(ocr_res)
            output_files.append(_make_output_file(job_id, job.download_token, out_p, "searchable_ocr_document.pdf", "application/pdf"))

        elif tool_id == "flatten-pdf":
            out_p = job_dir / "flattened_document.pdf"
            compress.flatten_pdf(input_paths[0], out_p)
            output_files.append(_make_output_file(job_id, job.download_token, out_p, "flattened_document.pdf", "application/pdf"))

        elif tool_id == "pdf-to-pdfa":
            out_p = job_dir / "archival_document_pdfa.pdf"
            pdfa_res = compress.pdf_to_pdfa(input_paths[0], out_p)
            meta_update.update(pdfa_res)
            output_files.append(_make_output_file(job_id, job.download_token, out_p, "archival_document_pdfa.pdf", "application/pdf"))

        # -------------------------------------------------------------
        # Category C: Convert to PDF
        # -------------------------------------------------------------
        elif tool_id in ("jpg-to-pdf", "png-to-pdf", "webp-to-pdf", "tiff-to-pdf", "images-to-pdf"):
            out_p = job_dir / "converted_images.pdf"
            orient = opts.get("orientation", "auto")
            margin = float(opts.get("margin", 18.0))
            fit = bool(opts.get("fit_to_page", True))
            convert_to_pdf.images_to_pdf(input_paths, out_p, orientation=orient, margin_pt=margin, fit_to_page=fit)
            output_files.append(_make_output_file(job_id, job.download_token, out_p, "converted_images.pdf", "application/pdf"))

        elif tool_id == "scan-to-pdf":
            out_p = job_dir / "scanned_document.pdf"
            enhance = bool(opts.get("enhance_contrast", True))
            convert_to_pdf.scan_to_pdf(input_paths, out_p, enhance_contrast=enhance)
            output_files.append(_make_output_file(job_id, job.download_token, out_p, "scanned_document.pdf", "application/pdf"))

        elif tool_id in ("word-to-pdf", "powerpoint-to-pdf", "excel-to-pdf"):
            out_p = job_dir / f"{input_paths[0].stem}.pdf"
            convert_to_pdf.office_to_pdf(input_paths[0], out_p)
            output_files.append(_make_output_file(job_id, job.download_token, out_p, f"{input_paths[0].stem}.pdf", "application/pdf"))

        elif tool_id == "txt-to-pdf":
            out_p = job_dir / f"{input_paths[0].stem}.pdf"
            convert_to_pdf.txt_to_pdf(input_paths[0], out_p)
            output_files.append(_make_output_file(job_id, job.download_token, out_p, f"{input_paths[0].stem}.pdf", "application/pdf"))

        elif tool_id == "markdown-to-pdf":
            out_p = job_dir / f"{input_paths[0].stem}.pdf"
            convert_to_pdf.markdown_to_pdf(input_paths[0], out_p)
            output_files.append(_make_output_file(job_id, job.download_token, out_p, f"{input_paths[0].stem}.pdf", "application/pdf"))

        elif tool_id == "html-to-pdf":
            out_p = job_dir / f"{input_paths[0].stem}.pdf"
            convert_to_pdf.html_to_pdf(input_paths[0], out_p)
            output_files.append(_make_output_file(job_id, job.download_token, out_p, f"{input_paths[0].stem}.pdf", "application/pdf"))

        # -------------------------------------------------------------
        # Category D: Convert from PDF
        # -------------------------------------------------------------
        elif tool_id in ("pdf-to-jpg", "pdf-to-png"):
            img_format = "jpg" if tool_id == "pdf-to-jpg" else "png"
            dpi = int(opts.get("dpi", 150))
            out_dir = job_dir / "exported_images"
            out_dir.mkdir(exist_ok=True)
            imgs = convert_from_pdf.pdf_to_images(input_paths[0], out_dir, img_format=img_format, dpi=dpi)
            output_files = _package_multiple_or_single(job_id, job.download_token, imgs, job_dir, f"{input_paths[0].stem}_images.zip")

        elif tool_id == "pdf-to-word":
            out_p = job_dir / f"{input_paths[0].stem}.docx"
            convert_from_pdf.pdf_to_docx(input_paths[0], out_p)
            output_files.append(_make_output_file(job_id, job.download_token, out_p, f"{input_paths[0].stem}.docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"))

        elif tool_id == "pdf-to-excel":
            out_p = job_dir / f"{input_paths[0].stem}.xlsx"
            convert_from_pdf.pdf_to_xlsx(input_paths[0], out_p)
            output_files.append(_make_output_file(job_id, job.download_token, out_p, f"{input_paths[0].stem}.xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"))

        elif tool_id == "pdf-to-powerpoint":
            out_p = job_dir / f"{input_paths[0].stem}.pptx"
            convert_from_pdf.pdf_to_pptx(input_paths[0], out_p)
            output_files.append(_make_output_file(job_id, job.download_token, out_p, f"{input_paths[0].stem}.pptx", "application/vnd.openxmlformats-officedocument.presentationml.presentation"))

        elif tool_id in ("pdf-to-txt", "extract-text"):
            out_p = job_dir / f"{input_paths[0].stem}.txt"
            convert_from_pdf.pdf_to_txt(input_paths[0], out_p)
            output_files.append(_make_output_file(job_id, job.download_token, out_p, f"{input_paths[0].stem}.txt", "text/plain"))

        elif tool_id == "pdf-to-html":
            out_p = job_dir / f"{input_paths[0].stem}.html"
            convert_from_pdf.pdf_to_html(input_paths[0], out_p)
            output_files.append(_make_output_file(job_id, job.download_token, out_p, f"{input_paths[0].stem}.html", "text/html"))

        elif tool_id == "pdf-to-markdown":
            out_p = job_dir / f"{input_paths[0].stem}.md"
            convert_from_pdf.pdf_to_markdown(input_paths[0], out_p)
            output_files.append(_make_output_file(job_id, job.download_token, out_p, f"{input_paths[0].stem}.md", "text/markdown"))

        elif tool_id == "extract-tables":
            out_dir = job_dir / "extracted_tables"
            out_dir.mkdir(exist_ok=True)
            tbls = convert_from_pdf.extract_tables(input_paths[0], out_dir)
            output_files = _package_multiple_or_single(job_id, job.download_token, tbls, job_dir, "extracted_tables.zip")

        elif tool_id == "extract-images":
            out_dir = job_dir / "extracted_images"
            out_dir.mkdir(exist_ok=True)
            imgs = convert_from_pdf.extract_images(input_paths[0], out_dir)
            output_files = _package_multiple_or_single(job_id, job.download_token, imgs, job_dir, "extracted_images.zip")

        # -------------------------------------------------------------
        # Category E: Edit and annotate PDF
        # -------------------------------------------------------------
        elif tool_id in ("edit-pdf", "visual-edit-pdf") or opts.get("visual_edits"):
            out_p = job_dir / "edited_document.pdf"
            v_edits = opts.get("visual_edits", [])
            res_meta = editor.apply_visual_edits(input_paths[0], out_p, edits=v_edits)
            meta_update.update(res_meta)
            output_files.append(_make_output_file(job_id, job.download_token, out_p, "edited_document.pdf", "application/pdf"))

        elif tool_id == "edit-text":
            out_p = job_dir / "edited_document.pdf"
            find_txt = opts.get("find_text", "")
            repl_txt = opts.get("replace_text", "")
            pages = opts.get("pages", "")
            color = opts.get("color", "#111827")
            res_meta = editor.replace_text_in_pdf(input_paths[0], out_p, find_text=find_txt, replace_text=repl_txt, page_indices_str=pages, color_hex=color)
            meta_update.update(res_meta)
            output_files.append(_make_output_file(job_id, job.download_token, out_p, "edited_document.pdf", "application/pdf"))

        elif tool_id == "add-text":
            out_p = job_dir / "text_added.pdf"
            txt = opts.get("text", "Sample Text")
            p_idx = int(opts.get("page", 1)) - 1
            x = float(opts.get("x", 72))
            y = float(opts.get("y", 72))
            fsize = float(opts.get("font_size", 14))
            color = opts.get("color", "#111827")
            editor.add_text_to_pdf(input_paths[0], out_p, text=txt, page_idx=p_idx, x=x, y=y, font_size=fsize, color_hex=color)
            output_files.append(_make_output_file(job_id, job.download_token, out_p, "text_added.pdf", "application/pdf"))

        elif tool_id == "add-image":
            out_p = job_dir / "image_stamped.pdf"
            stamp_img = input_paths[1] if len(input_paths) > 1 else input_paths[0]
            base_pdf = input_paths[0]
            p_idx = int(opts.get("page", 1)) - 1
            x = float(opts.get("x", 72))
            y = float(opts.get("y", 72))
            w = float(opts.get("width", 150))
            h = float(opts.get("height", 100))
            editor.add_image_to_pdf(base_pdf, out_p, stamp_img, page_idx=p_idx, x=x, y=y, width=w, height=h)
            output_files.append(_make_output_file(job_id, job.download_token, out_p, "image_stamped.pdf", "application/pdf"))

        elif tool_id == "highlight-text":
            out_p = job_dir / "highlighted.pdf"
            q = opts.get("query", "")
            c = opts.get("color", "#fde047")
            editor.highlight_text(input_paths[0], out_p, search_query=q, color_hex=c)
            output_files.append(_make_output_file(job_id, job.download_token, out_p, "highlighted.pdf", "application/pdf"))

        elif tool_id == "underline-strikethrough":
            out_p = job_dir / "annotated_markup.pdf"
            q = opts.get("query", "")
            act = opts.get("action", "underline")
            c = opts.get("color", "#ef4444")
            editor.underline_or_strike(input_paths[0], out_p, search_query=q, action=act, color_hex=c)
            output_files.append(_make_output_file(job_id, job.download_token, out_p, "annotated_markup.pdf", "application/pdf"))

        elif tool_id == "draw-freehand":
            out_p = job_dir / "freehand_drawing.pdf"
            p_idx = int(opts.get("page", 1)) - 1
            pts = opts.get("points", [(100, 100), (200, 200)])
            c = opts.get("color", "#2563eb")
            w = float(opts.get("stroke_width", 2.5))
            editor.draw_freehand(input_paths[0], out_p, page_idx=p_idx, stroke_points=pts, color_hex=c, width=w)
            output_files.append(_make_output_file(job_id, job.download_token, out_p, "freehand_drawing.pdf", "application/pdf"))

        elif tool_id == "add-shapes":
            out_p = job_dir / "shapes_added.pdf"
            p_idx = int(opts.get("page", 1)) - 1
            shapes = opts.get("shapes", [{"type": "rect", "x": 100, "y": 100, "w": 120, "h": 60, "stroke_color": "#2563eb"}])
            editor.add_shapes(input_paths[0], out_p, page_idx=p_idx, shapes=shapes)
            output_files.append(_make_output_file(job_id, job.download_token, out_p, "shapes_added.pdf", "application/pdf"))

        elif tool_id == "add-comments":
            out_p = job_dir / "comments_added.pdf"
            p_idx = int(opts.get("page", 1)) - 1
            x = float(opts.get("x", 100))
            y = float(opts.get("y", 100))
            note = opts.get("comment", "Review note")
            editor.add_comment_note(input_paths[0], out_p, page_idx=p_idx, x=x, y=y, comment_text=note)
            output_files.append(_make_output_file(job_id, job.download_token, out_p, "comments_added.pdf", "application/pdf"))

        elif tool_id == "add-watermark":
            out_p = job_dir / "watermarked.pdf"
            txt = opts.get("text", "CONFIDENTIAL")
            opac = float(opts.get("opacity", 0.3))
            rot = float(opts.get("rotation", 45.0))
            fsize = float(opts.get("font_size", 48.0))
            color = opts.get("color", "#94a3b8")
            layer = opts.get("layer", "over")
            editor.add_watermark(input_paths[0], out_p, text=txt, opacity=opac, rotation=rot, font_size=fsize, color_hex=color, layer=layer)
            output_files.append(_make_output_file(job_id, job.download_token, out_p, "watermarked.pdf", "application/pdf"))

        elif tool_id == "add-header-footer":
            out_p = job_dir / "headers_footers_added.pdf"
            editor.add_header_footer(
                input_paths[0], out_p,
                header_left=opts.get("header_left", ""),
                header_center=opts.get("header_center", ""),
                header_right=opts.get("header_right", ""),
                footer_left=opts.get("footer_left", ""),
                footer_center=opts.get("footer_center", ""),
                footer_right=opts.get("footer_right", ""),
                font_size=float(opts.get("font_size", 9.0))
            )
            output_files.append(_make_output_file(job_id, job.download_token, out_p, "headers_footers_added.pdf", "application/pdf"))

        elif tool_id == "crop-margins":
            out_p = job_dir / "cropped_margins.pdf"
            margin = float(opts.get("margin", 20.0))
            organize.crop_pdf(input_paths[0], out_p, top=margin, bottom=margin, left=margin, right=margin)
            output_files.append(_make_output_file(job_id, job.download_token, out_p, "cropped_margins.pdf", "application/pdf"))

        elif tool_id == "fill-form":
            out_p = job_dir / "filled_form.pdf"
            f_values = opts.get("fields", {})
            editor.fill_form_fields(input_paths[0], out_p, f_values)
            output_files.append(_make_output_file(job_id, job.download_token, out_p, "filled_form.pdf", "application/pdf"))

        elif tool_id == "flatten-form":
            out_p = job_dir / "flattened_form.pdf"
            compress.flatten_pdf(input_paths[0], out_p)
            output_files.append(_make_output_file(job_id, job.download_token, out_p, "flattened_form.pdf", "application/pdf"))

        elif tool_id == "annotate-pdf":
            out_p = job_dir / "annotated_document.pdf"
            # General annotation wrapper
            note = opts.get("note", "Reviewed")
            p_idx = int(opts.get("page", 1)) - 1
            editor.add_comment_note(input_paths[0], out_p, page_idx=p_idx, x=72, y=72, comment_text=note)
            output_files.append(_make_output_file(job_id, job.download_token, out_p, "annotated_document.pdf", "application/pdf"))

        elif tool_id == "add-stamp":
            out_p = job_dir / "stamped_document.pdf"
            stamp_text = opts.get("stamp_text", "APPROVED")
            stamp_color = opts.get("color", "#16a34a")
            p_idx = int(opts.get("page", 1)) - 1
            x = float(opts.get("x", 380))
            y = float(opts.get("y", 60))
            editor.add_stamp(input_paths[0], out_p, stamp_text=stamp_text, color_hex=stamp_color, page_idx=p_idx, x=x, y=y)
            output_files.append(_make_output_file(job_id, job.download_token, out_p, "stamped_document.pdf", "application/pdf"))

        # -------------------------------------------------------------
        # Category F: Sign PDF
        # -------------------------------------------------------------
        elif tool_id in ("create-signature", "sign-pdf", "fill-and-sign"):
            out_p = job_dir / "signed_document.pdf"
            p_idx = int(opts.get("page", 1)) - 1
            x = float(opts.get("x", 100))
            y = float(opts.get("y", 650))
            signer = opts.get("signer_name", "Authorized Signer")

            if len(input_paths) > 1:
                # User uploaded a signature image as 2nd file
                editor.add_image_to_pdf(input_paths[0], out_p, input_paths[1], page_idx=p_idx, x=x, y=y, width=140, height=50)
            else:
                # Stamp cursive visual signature
                stamp_text = f"Signed by {signer}"
                editor.add_text_to_pdf(input_paths[0], out_p, text=stamp_text, page_idx=p_idx, x=x, y=y, font_size=13, color_hex="#1e3a8a")

            meta_update["disclaimer"] = "Visual electronic signature applied. Not a certificate-based cryptographic signature."
            output_files.append(_make_output_file(job_id, job.download_token, out_p, "signed_document.pdf", "application/pdf"))

        # -------------------------------------------------------------
        # Category G: PDF security and privacy
        # -------------------------------------------------------------
        elif tool_id == "protect-pdf":
            out_p = job_dir / "protected_document.pdf"
            pwd = opts.get("password", "")
            security_service.protect_pdf(input_paths[0], out_p, user_password=pwd)
            output_files.append(_make_output_file(job_id, job.download_token, out_p, "protected_document.pdf", "application/pdf"))

        elif tool_id == "unlock-pdf":
            out_p = job_dir / "unlocked_document.pdf"
            pwd = opts.get("password", "")
            security_service.unlock_pdf(input_paths[0], out_p, password=pwd)
            output_files.append(_make_output_file(job_id, job.download_token, out_p, "unlocked_document.pdf", "application/pdf"))

        elif tool_id == "redact-pdf":
            out_p = job_dir / "redacted_sanitized.pdf"
            keywords = opts.get("keywords", [])
            boxes = opts.get("boxes", [])
            redact_res = security_service.redact_pdf(input_paths[0], out_p, redactions=boxes, search_keywords=keywords)
            meta_update.update(redact_res)
            output_files.append(_make_output_file(job_id, job.download_token, out_p, "redacted_sanitized.pdf", "application/pdf"))

        elif tool_id == "remove-metadata":
            out_p = job_dir / "metadata_cleared.pdf"
            security_service.remove_metadata(input_paths[0], out_p)
            output_files.append(_make_output_file(job_id, job.download_token, out_p, "metadata_cleared.pdf", "application/pdf"))

        elif tool_id == "compare-pdfs":
            if len(input_paths) < 2:
                raise ValueError("Comparison requires two PDF documents")
            out_p = job_dir / "comparison_report.txt"
            comp_res = security_service.compare_pdfs(input_paths[0], input_paths[1], out_p)
            meta_update.update(comp_res)
            output_files.append(_make_output_file(job_id, job.download_token, out_p, "comparison_report.txt", "text/plain"))

        elif tool_id == "pdf-info":
            info_res = security_service.get_pdf_info(input_paths[0])
            out_p = job_dir / "pdf_metadata_info.json"
            with open(out_p, "w", encoding="utf-8") as f:
                json.dump(info_res, f, indent=2)
            meta_update.update(info_res)
            output_files.append(_make_output_file(job_id, job.download_token, out_p, "pdf_metadata_info.json", "application/json"))

        elif tool_id == "check-integrity":
            integ_res = security_service.check_pdf_integrity(input_paths[0])
            out_p = job_dir / "integrity_audit.json"
            with open(out_p, "w", encoding="utf-8") as f:
                json.dump(integ_res, f, indent=2)
            meta_update.update(integ_res)
            output_files.append(_make_output_file(job_id, job.download_token, out_p, "integrity_audit.json", "application/json"))

        # -------------------------------------------------------------
        # Category H: Advanced document and AI utilities
        # -------------------------------------------------------------
        elif tool_id == "pdf-summarizer":
            summary_res = await ai_service.summarize_pdf(input_paths[0])
            out_p = job_dir / "document_summary.txt"
            with open(out_p, "w", encoding="utf-8") as f:
                f.write("=== FOLDORA PDF DOCUMENT SUMMARY ===\n\n")
                f.write(summary_res.get("summary", ""))
                f.write("\n\nKey Takeaways:\n")
                for tk in summary_res.get("key_takeaways", []):
                    f.write(f"• {tk}\n")
            meta_update.update(summary_res)
            output_files.append(_make_output_file(job_id, job.download_token, out_p, "document_summary.txt", "text/plain"))

        elif tool_id == "ask-pdf":
            q = opts.get("question", "What is the summary of this document?")
            ans_res = await ai_service.ask_pdf(input_paths[0], q)
            out_p = job_dir / "qa_response.txt"
            with open(out_p, "w", encoding="utf-8") as f:
                f.write(f"Question: {q}\n\nAnswer:\n{ans_res.get('answer', '')}\n")
            meta_update.update(ans_res)
            output_files.append(_make_output_file(job_id, job.download_token, out_p, "qa_response.txt", "text/plain"))

        elif tool_id == "translate-pdf":
            out_p = job_dir / "translated_document.txt"
            target_l = opts.get("language", "es")
            ai_service.translate_pdf_text(input_paths[0], out_p, target_language=target_l)
            output_files.append(_make_output_file(job_id, job.download_token, out_p, "translated_document.txt", "text/plain"))

        elif tool_id == "extract-structured-data":
            out_p = job_dir / "structured_data.json"
            struct_res = ai_service.extract_structured_data(input_paths[0], out_p)
            meta_update.update(struct_res)
            output_files.append(_make_output_file(job_id, job.download_token, out_p, "structured_data.json", "application/json"))

        else:
            raise ValueError(f"Unknown or unsupported tool ID: {tool_id}")

        # Finalize job
        job_manager.update_job(
            job_id,
            status=JobStatus.COMPLETED,
            progress=100,
            message="Processing completed successfully",
            output_files=output_files,
            metadata=meta_update
        )
        logger.info("Job %s completed successfully with %d output file(s)", job_id, len(output_files))

    except Exception as exc:
        logger.exception("Error executing job %s: %s", job_id, exc)
        job_manager.update_job(
            job_id,
            status=JobStatus.FAILED,
            progress=0,
            message="Processing failed",
            error=str(exc)
        )
    finally:
        job_manager.release_slot()


def _make_output_file(job_id: str, download_token: str, file_path: Path, filename: str, mime: str) -> OutputFile:
    size = file_path.stat().st_size if file_path.exists() else 0
    return OutputFile(
        file_id=file_path.name,
        filename=filename,
        size_bytes=size,
        content_type=mime,
        download_url=f"/api/jobs/{job_id}/download?token={download_token}&file_id={file_path.name}"
    )


def _package_multiple_or_single(
    job_id: str,
    download_token: str,
    files: List[Path],
    job_dir: Path,
    zip_name: str
) -> List[OutputFile]:
    """If single file, return it directly. If multiple, package into zip."""
    if not files:
        raise ValueError("No files were produced during processing")

    if len(files) == 1:
        f = files[0]
        mime = "application/pdf" if f.suffix == ".pdf" else "application/octet-stream"
        return [_make_output_file(job_id, download_token, f, f.name, mime)]

    # Multiple files -> ZIP archive
    zip_path = job_dir / zip_name
    items = [(f, f.name) for f in files]
    create_zip_archive(zip_path, items)
    return [_make_output_file(job_id, download_token, zip_path, zip_name, "application/zip")]
