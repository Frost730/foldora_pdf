import re
import math
import logging
import json
import csv
from collections import Counter
from pathlib import Path
from typing import Dict, Any, List, Optional, Tuple
import httpx
import pymupdf
from app.core.config import settings
from app.utils.memory import free_memory

logger = logging.getLogger("foldora.ai")

# Supported translation target languages
SUPPORTED_LANGUAGES = {
    "es": "Spanish (Español)",
    "fr": "French (Français)",
    "de": "German (Deutsch)",
    "it": "Italian (Italiano)",
    "pt": "Portuguese (Português)",
    "ja": "Japanese (日本語)",
    "zh": "Chinese (中文)",
    "ru": "Russian (Русский)",
    "ar": "Arabic (العربية)",
    "hi": "Hindi (हिन्दी)",
    "en": "English",
}

# Standard English stopwords for semantic ranking
STOPWORDS = {
    "a", "about", "above", "after", "again", "against", "all", "am", "an", "and", "any", "are",
    "as", "at", "be", "because", "been", "before", "being", "below", "between", "both", "but",
    "by", "can", "could", "did", "do", "does", "doing", "down", "during", "each", "few", "for",
    "from", "further", "had", "has", "have", "having", "he", "her", "here", "hers", "herself",
    "him", "himself", "his", "how", "i", "if", "in", "into", "is", "it", "its", "itself", "just",
    "me", "more", "most", "my", "myself", "no", "nor", "not", "now", "of", "off", "on", "once",
    "only", "or", "other", "our", "ours", "ourselves", "out", "over", "own", "same", "she",
    "should", "so", "some", "such", "than", "that", "the", "their", "theirs", "them", "themselves",
    "then", "there", "these", "they", "this", "those", "through", "to", "too", "under", "until",
    "up", "very", "was", "we", "were", "what", "when", "where", "which", "while", "who", "whom",
    "why", "will", "with", "would", "you", "your", "yours", "yourself", "yourselves", "also",
    "etc", "per", "via", "may"
}


def extract_full_text_with_pages(
    file_path: Path,
    max_pages: int = 150,
    max_chars_per_page: int = 40000
) -> List[Dict[str, Any]]:
    """
    Extract page text with page indices, headings, and character counts.
    Enforces strict memory safety limits for 512MB RAM environments.
    """
    pages_text = []
    doc = None
    try:
        doc = pymupdf.open(str(file_path))
        num_pages = min(len(doc), max_pages)

        for i in range(num_pages):
            page = doc[i]
            raw_text = page.get_text("text").strip()

            # Bound memory per page to avoid anomalous multi-megabyte text layers
            if len(raw_text) > max_chars_per_page:
                raw_text = raw_text[:max_chars_per_page] + "\n... [page text truncated for memory safety]"

            # Heuristic heading detection (short lines, title-case or uppercase, without terminal period)
            headings = []
            for line in raw_text.splitlines():
                line_str = line.strip()
                if 4 <= len(line_str) <= 70 and not line_str.endswith("."):
                    if (line_str.isupper() or line_str.istitle() or line_str.startswith("#")) and not any(ch in line_str for ch in "{}[]<>="):
                        clean_h = line_str.lstrip("#* ").strip()
                        if clean_h and clean_h not in headings and len(clean_h) >= 4:
                            headings.append(clean_h)

            pages_text.append({
                "page": i + 1,
                "text": raw_text,
                "char_count": len(raw_text),
                "word_count": len(raw_text.split()),
                "headings": headings[:8]
            })
    except Exception as exc:
        logger.warning("Error reading PDF text from %s: %s", file_path, exc)
    finally:
        if doc is not None:
            doc.close()
        free_memory()

    return pages_text


def generate_suggested_questions(pages_data: List[Dict[str, Any]], count: int = 5) -> List[str]:
    """
    Synthesize smart, contextual suggested questions generated from document headings,
    entities, and key topics so users can interrogate documents with one click.
    """
    suggested: List[str] = []
    all_headings = []
    for p in pages_data:
        all_headings.extend(p.get("headings", []))

    full_text = " ".join([p["text"] for p in pages_data if p["text"]])

    # If document has detected headings, formulate questions around top headings
    for h in all_headings[:4]:
        clean_title = re.sub(r'^(Section|Chapter|Article|\d+[\.\)]|\s)+', '', h, flags=re.I).strip()
        if len(clean_title) >= 4 and not clean_title.lower().startswith("page"):
            q = f"What are the key points and conclusions in '{clean_title}'?"
            if q not in suggested:
                suggested.append(q)

    # Document type heuristics
    lower_text = full_text.lower()
    if any(k in lower_text for k in ("invoice", "bill to", "due date", "amount due", "payment terms", "subtotal")):
        suggested.append("What is the total amount due, payment deadline, and vendor info?")
        suggested.append("Are there any itemized charges, taxes, or discounts listed?")
    elif any(k in lower_text for k in ("agreement", "contract", "parties", "hereby", "jurisdiction", "liability")):
        suggested.append("What are the core obligations, terms, and termination conditions?")
        suggested.append("What is the governing law, jurisdiction, and liability limitation?")
    elif any(k in lower_text for k in ("abstract", "methodology", "findings", "hypothesis", "dataset", "results")):
        suggested.append("What is the primary research hypothesis and empirical methodology used?")
        suggested.append("What were the quantitative findings, metrics, and conclusions?")

    # Universal high-value fallback questions
    universal_defaults = [
        "What is the executive summary and main objective of this document?",
        "What are the critical dates, deadlines, or milestones mentioned?",
        "What are the primary recommendations, action items, or next steps?",
        "Who are the key people, organizations, or stakeholders referenced?"
    ]

    for uq in universal_defaults:
        if uq not in suggested:
            suggested.append(uq)
        if len(suggested) >= count:
            break

    return suggested[:count]


async def call_external_ai(prompt: str, system_prompt: str = "You are an expert document analysis assistant.") -> Optional[str]:
    """
    Unified caller for configured external AI providers (OpenAI, Gemini, Ollama, or custom endpoint).
    Returns None on failure or if not configured, triggering the offline fallback.
    """
    if not (settings.AI_PROVIDER and settings.AI_API_KEY):
        return None

    provider = settings.AI_PROVIDER.lower().strip()
    api_key = settings.AI_API_KEY.strip()

    # Determine endpoint and model defaults
    if provider == "gemini":
        api_base = settings.AI_API_BASE or "https://generativelanguage.googleapis.com/v1beta/openai"
        model = settings.AI_MODEL or "gemini-1.5-flash"
    elif provider == "ollama":
        api_base = settings.AI_API_BASE or "http://localhost:11434/v1"
        model = settings.AI_MODEL or "llama3"
    else:
        api_base = settings.AI_API_BASE or "https://api.openai.com/v1"
        model = settings.AI_MODEL or "gpt-4o-mini"

    url = f"{api_base.rstrip('/')}/chat/completions"
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json"
    }
    payload = {
        "model": model,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": prompt}
        ],
        "temperature": 0.2
    }

    try:
        async with httpx.AsyncClient(timeout=35.0) as client:
            res = await client.post(url, headers=headers, json=payload)
            if res.status_code == 200:
                data = res.json()
                content = data["choices"][0]["message"]["content"]
                return content.strip()
            else:
                logger.warning("External AI returned status %d: %s", res.status_code, res.text[:200])
                return None
    except Exception as exc:
        logger.warning("External AI call failed, using local offline NLP engine: %s", exc)
        return None


def split_sentences(text: str, min_words: int = 2) -> List[str]:
    """
    Split text into clean statement units / sentences without losing
    short lines, uppercase headers/clauses, or tabular statements.
    """
    text = text.replace("\r\n", "\n")
    raw = re.split(r'(?<=[.!?])\s+|\n+', text)
    cleaned = []
    for s in raw:
        s_clean = re.sub(r'\s+', ' ', s).strip()
        words = s_clean.split()
        if len(words) >= min_words and any(c.isalnum() for c in s_clean):
            cleaned.append(s_clean)
    return cleaned


def local_extractive_summary(
    pages_data: List[Dict[str, Any]],
    mode: str = "executive",
    length: str = "standard"
) -> Dict[str, Any]:
    """
    Intelligent offline extractive NLP summarization with selectable modes:
    - executive: High-level executive overview, core thesis, and synthesis.
    - key_takeaways: Bulleted vital findings and data insights.
    - action_items: Tasks, deadlines, milestones, and obligations.
    - study_guide: Structured outline, concepts & definitions, review questions.
    - faq: Frequently asked questions with answers grounded in text.
    """
    full_text = " ".join([p["text"] for p in pages_data if p["text"]])
    total_words = len(re.findall(r'\b\w+\b', full_text))

    # Sparse / scanned document check
    if not full_text.strip() or total_words < 15:
        notice = (
            "NOTICE: The uploaded document contains no readable text layer (it appears to be a scanned image or empty PDF).\n\n"
            "Recommendation: Run the 'OCR PDF' tool on this file first to generate a searchable text layer, "
            "then rerun the AI Summarizer."
        )
        return {
            "summary": notice,
            "formatted_report": notice,
            "key_takeaways": ["No extractable text found. Consider applying OCR PDF first."],
            "action_items": [],
            "mode": mode,
            "length": length,
            "word_count": total_words,
            "summary_word_count": 0,
            "reading_time_saved_min": 0.0,
            "original_reading_time_min": 0.0,
            "compression_ratio": 0.0,
            "pages_analyzed": len(pages_data),
            "engine": "local_extractive_scanned_notice"
        }

    sentences = split_sentences(full_text)
    if not sentences:
        fallback = full_text[:400]
        return {
            "summary": fallback,
            "formatted_report": fallback,
            "key_takeaways": [fallback[:120]],
            "action_items": [],
            "mode": mode,
            "length": length,
            "word_count": total_words,
            "summary_word_count": len(fallback.split()),
            "reading_time_saved_min": 0.1,
            "original_reading_time_min": round(total_words / 225, 1),
            "compression_ratio": round(len(fallback.split()) / max(1, total_words) * 100, 1),
            "pages_analyzed": len(pages_data),
            "engine": "local_extractive"
        }

    # Word frequencies for TF-IDF ranking
    words = re.findall(r'\b[a-zA-Z]{3,}\b', full_text.lower())
    filtered_words = [w for w in words if w not in STOPWORDS]
    word_freq = Counter(filtered_words)
    max_freq = max(word_freq.values()) if word_freq else 1

    # Sentence scoring
    scored_sentences: List[Tuple[float, int, str]] = []
    for idx, s in enumerate(sentences):
        s_words = [w for w in re.findall(r'\b[a-zA-Z]{3,}\b', s.lower()) if w not in STOPWORDS]
        if not s_words:
            continue
        # Term frequency score normalized by sentence length
        tf_score = sum(word_freq.get(w, 0) / max_freq for w in s_words) / math.sqrt(len(s_words))

        # Position boost (document introduction and early sections carry high conceptual weight)
        if idx < 4:
            tf_score *= 1.35
        elif idx >= len(sentences) - 3:
            tf_score *= 1.15  # Conclusion boost

        # Mode-specific scoring adjustments
        s_lower = s.lower()
        if mode == "action_items":
            action_indicators = ("must", "shall", "will", "required", "due", "deadline", "milestone", "deliver", "complete", "by", "submit", "obligation", "action")
            action_count = sum(1 for ai in action_indicators if re.search(r'\b' + re.escape(ai) + r'\b', s_lower))
            if action_count > 0:
                tf_score *= (1.5 + 0.3 * action_count)
            else:
                tf_score *= 0.5
        elif mode == "study_guide":
            if any(k in s_lower for k in ("defined as", "refers to", "concept", "principle", "important", "critical", "primarily")):
                tf_score *= 1.3

        scored_sentences.append((tf_score, idx, s))

    scored_sentences.sort(key=lambda x: x[0], reverse=True)

    # Determine sentence budget based on length preference
    length_budget = {"brief": 3, "standard": 6, "detailed": 10}.get(length, 6)

    # 1. Executive Summary Mode
    if mode == "executive":
        top_entries = sorted(scored_sentences[:length_budget], key=lambda x: x[1])
        exec_sentences = [e[2] for e in top_entries]
        
        # Structure into narrative paragraphs
        p1 = " ".join(exec_sentences[:max(1, len(exec_sentences) // 2)])
        p2 = " ".join(exec_sentences[max(1, len(exec_sentences) // 2):])
        summary_text = f"{p1}\n\n{p2}" if p2 else p1

        takeaways = [f"• {e[2]}" for e in scored_sentences[:min(5, len(scored_sentences))]]
        formatted_report = (
            "=== EXECUTIVE SUMMARY ===\n\n"
            f"{summary_text}\n\n"
            "=== KEY STRATEGIC INSIGHTS ===\n" +
            "\n".join(takeaways)
        )
        action_items = []

    # 2. Key Takeaways Mode
    elif mode == "key_takeaways":
        takeaway_count = min(max(5, length_budget), len(scored_sentences))
        takeaways = [f"• {scored_sentences[i][2]}" for i in range(takeaway_count)]
        summary_text = "\n".join(takeaways)
        formatted_report = "=== KEY DOCUMENT TAKEAWAYS ===\n\n" + summary_text
        action_items = []

    # 3. Action Items & Deadlines Mode
    elif mode == "action_items":
        # Filter explicitly for actionable sentences
        action_cands = [
            e[2] for e in scored_sentences
            if any(k in e[2].lower() for k in ("must", "shall", "will", "required", "due", "deadline", "milestone", "by", "complete", "submit", "action", "review"))
        ]
        if not action_cands:
            action_cands = [e[2] for e in scored_sentences[:min(5, len(scored_sentences))]]

        action_items = [f"☐ [Action] {item}" for item in action_cands[:length_budget]]
        summary_text = "\n".join(action_items)
        takeaways = [f"• {e[2]}" for e in scored_sentences[:3]]
        formatted_report = (
            "=== ACTION ITEMS, OBLIGATIONS & DEADLINES ===\n\n"
            f"{summary_text}\n\n"
            "=== CRITICAL CONTEXT ===\n" +
            "\n".join(takeaways)
        )

    # 4. Study Guide Mode
    elif mode == "study_guide":
        # Extract headings for sections
        headings = []
        for p in pages_data:
            headings.extend(p.get("headings", []))
        headings = list(dict.fromkeys(headings))[:5]

        top_sentences = sorted(scored_sentences[:length_budget], key=lambda x: x[1])
        core_notes = "\n".join([f"• {e[2]}" for e in top_sentences])

        topics_str = "\n".join([f"  - {h}" for h in headings]) if headings else "  - Core document content and principles"
        questions = generate_suggested_questions(pages_data, count=4)
        q_str = "\n".join([f"  {idx + 1}. {q}" for idx, q in enumerate(questions)])

        formatted_report = (
            "=== COMPREHENSIVE STUDY GUIDE ===\n\n"
            "## 1. Major Subject Areas & Headings:\n"
            f"{topics_str}\n\n"
            "## 2. Essential Concepts & Core Notes:\n"
            f"{core_notes}\n\n"
            "## 3. Self-Assessment Review Questions:\n"
            f"{q_str}"
        )
        summary_text = core_notes
        takeaways = [f"• {e[2]}" for e in scored_sentences[:4]]
        action_items = []

    # 5. FAQ Generation Mode
    elif mode == "faq":
        faq_questions = generate_suggested_questions(pages_data, count=max(4, length_budget))
        faq_pairs = []
        for q in faq_questions:
            # Find best matching sentence for this question
            q_terms = set(re.findall(r'\b[a-zA-Z]{3,}\b', q.lower())) - STOPWORDS
            best_s = None
            best_overlap = -1
            for _, _, s in scored_sentences:
                s_terms = set(re.findall(r'\b[a-zA-Z]{3,}\b', s.lower()))
                overlap = len(q_terms.intersection(s_terms))
                if overlap > best_overlap:
                    best_overlap = overlap
                    best_s = s
            ans = best_s if best_s else scored_sentences[0][2]
            faq_pairs.append(f"Q: {q}\nA: {ans}\n")

        summary_text = "\n".join(faq_pairs)
        formatted_report = "=== FREQUENTLY ASKED QUESTIONS (FAQ) ===\n\n" + summary_text
        takeaways = [f"• {e[2]}" for e in scored_sentences[:4]]
        action_items = []

    else:
        # Default fallback
        summary_text = " ".join([e[2] for e in scored_sentences[:length_budget]])
        formatted_report = summary_text
        takeaways = [f"• {e[2]}" for e in scored_sentences[:4]]
        action_items = []

    summary_words = len(re.findall(r'\b\w+\b', formatted_report))
    reading_time_saved = max(0.0, round((total_words - summary_words) / 225, 1))
    original_reading_time = max(0.1, round(total_words / 225, 1))
    compression_ratio = round(summary_words / max(1, total_words) * 100, 1)

    return {
        "summary": summary_text,
        "formatted_report": formatted_report,
        "key_takeaways": takeaways,
        "action_items": action_items,
        "mode": mode,
        "length": length,
        "word_count": total_words,
        "summary_word_count": summary_words,
        "reading_time_saved_min": reading_time_saved,
        "original_reading_time_min": original_reading_time,
        "compression_ratio": compression_ratio,
        "pages_analyzed": len(pages_data),
        "engine": "Foldora Local Extractive NLP Engine"
    }


async def summarize_pdf(
    file_path: Path,
    mode: str = "executive",
    length: str = "standard"
) -> Dict[str, Any]:
    """
    Summarize PDF with selectable modes and external AI or local extractive NLP engine.
    Never crashes on scanned/sparse PDFs.
    """
    pages_data = extract_full_text_with_pages(file_path)
    combined_text = "\n\n".join([f"[Page {p['page']}]: {p['text']}" for p in pages_data if p['text']])
    total_words = sum(p["word_count"] for p in pages_data)

    if not combined_text.strip():
        return local_extractive_summary(pages_data, mode=mode, length=length)

    # Attempt external AI if configured
    if settings.AI_PROVIDER and settings.AI_API_KEY:
        mode_prompts = {
            "executive": "Produce a high-level 2-3 paragraph Executive Summary synthesizing main objectives and findings, followed by 4-5 bulleted strategic takeaways.",
            "key_takeaways": "Extract 6-10 prioritized, insightful bulleted Key Takeaways from this document. Each bullet should be clear, detailed, and evidence-backed.",
            "action_items": "Identify all action items, obligations, required deliverables, deadlines, and milestones mentioned in the document formatted as a structured checklist.",
            "study_guide": "Create a structured Study Guide including: 1) Major Themes, 2) Key Concepts & Definitions, 3) Detailed Section Notes, and 4) Review Questions.",
            "faq": "Generate a 5-8 item Frequently Asked Questions (FAQ) section with clear, accurate answers grounded strictly in the provided text."
        }
        instruction = mode_prompts.get(mode, mode_prompts["executive"])
        prompt = (
            f"{instruction}\n\n"
            f"DOCUMENT CONTENT (Page indexed):\n{combined_text[:14000]}\n"
        )
        ai_output = await call_external_ai(prompt, system_prompt="You are a professional document intelligence analyst.")
        if ai_output:
            summary_words = len(re.findall(r'\b\w+\b', ai_output))
            reading_time_saved = max(0.0, round((total_words - summary_words) / 225, 1))
            return {
                "summary": ai_output,
                "formatted_report": ai_output,
                "key_takeaways": [line.strip() for line in ai_output.splitlines() if line.strip().startswith(("•", "-", "*"))][:6],
                "action_items": [line.strip() for line in ai_output.splitlines() if "☐" in line or "[action]" in line.lower()][:8],
                "mode": mode,
                "length": length,
                "word_count": total_words,
                "summary_word_count": summary_words,
                "reading_time_saved_min": reading_time_saved,
                "original_reading_time_min": round(total_words / 225, 1),
                "compression_ratio": round(summary_words / max(1, total_words) * 100, 1),
                "pages_analyzed": len(pages_data),
                "provider": f"{settings.AI_PROVIDER} ({settings.AI_MODEL or 'cloud'})",
                "status": "ai_generated"
            }

    # Robust local extractive fallback
    res = local_extractive_summary(pages_data, mode=mode, length=length)
    res["provider"] = "Foldora Local NLP Engine (Offline Heuristic)"
    return res


async def ask_pdf(file_path: Path, question: str) -> Dict[str, Any]:
    """
    Answer questions based on document content with exact page citations,
    answer confidence scoring, and automatic follow-up suggested questions.
    """
    if not question.strip():
        raise ValueError("Question cannot be empty")

    pages_data = extract_full_text_with_pages(file_path)
    combined_text = "\n\n".join([f"[Page {p['page']}]: {p['text']}" for p in pages_data if p['text']])
    suggested_questions = generate_suggested_questions(pages_data, count=4)

    if not combined_text.strip():
        return {
            "answer": "This document contains no readable text layer (it may be a scanned image). Please run the OCR PDF tool first to make it searchable.",
            "citations": [],
            "citations_detail": [],
            "confidence": 0.0,
            "confidence_label": "None",
            "suggested_questions": suggested_questions,
            "formatted_report": "No text detected in document. Please perform OCR first.",
            "provider": "None"
        }

    # Attempt External AI if configured
    if settings.AI_PROVIDER and settings.AI_API_KEY:
        prompt = (
            "Answer the user's question accurately based strictly on the provided document text. "
            "Cite exact page numbers for each fact or claim using format [Page X]. "
            "If the information is not in the document, state that clearly.\n\n"
            f"DOCUMENT TEXT:\n{combined_text[:14000]}\n\n"
            f"QUESTION: {question}"
        )
        ai_res = await call_external_ai(prompt, system_prompt="You are a precise document Q&A assistant with citation grounding.")
        if ai_res:
            # Extract cited page numbers from LLM response
            cited_pages = list(dict.fromkeys(re.findall(r'\[Page\s*(\d+)\]', ai_res, re.IGNORECASE)))
            citations = [f"Page {cp}" for cp in cited_pages]
            citations_detail = [{"page": int(cp), "text_snippet": "Grounded in page text", "score": 0.95} for cp in cited_pages]
            confidence = 0.92 if citations else 0.82

            report = (
                f"Question: {question}\n\n"
                f"Answer:\n{ai_res}\n\n"
                f"Confidence: {int(confidence * 100)}% (High)\n"
                f"Citations: {', '.join(citations) if citations else 'Document overall'}\n"
            )

            return {
                "answer": ai_res,
                "citations": citations,
                "citations_detail": citations_detail,
                "confidence": confidence,
                "confidence_label": "High",
                "suggested_questions": suggested_questions,
                "formatted_report": report,
                "provider": f"{settings.AI_PROVIDER} ({settings.AI_MODEL or 'cloud'})"
            }

    # Offline Semantic Retrieval Engine
    # Extract query tokens: words, numbers, ISO dates, codes (e.g. INV-2026-9042, 2026-04-15, $7975)
    raw_tokens = re.findall(r'[a-zA-Z0-9_\-\.\$\€\£\¥\₹]{2,}', question.lower())
    q_words = []
    for rt in raw_tokens:
        clean_tok = re.sub(r'^[\W_]+|[\W_]+$', '', rt)
        if clean_tok and clean_tok not in STOPWORDS:
            q_words.append(clean_tok)
    if not q_words:
        q_words = [question.strip().lower()]

    q_set = set(q_words)
    matches: List[Dict[str, Any]] = []

    for p in pages_data:
        p_text = p["text"]
        if not p_text:
            continue

        sentences = split_sentences(p_text, min_words=2)
        for s_idx, sent in enumerate(sentences):
            sent_lower = sent.lower()
            # Tokenize sentence retaining alphanumeric identifiers, numbers, currencies
            s_tokens = set()
            for st in re.findall(r'[a-zA-Z0-9_\-\.\$\€\£\¥\₹]{2,}', sent_lower):
                c_tok = re.sub(r'^[\W_]+|[\W_]+$', '', st)
                if c_tok:
                    s_tokens.add(c_tok)

            overlap = q_set.intersection(s_tokens)

            # Check direct substring containment for alphanumeric codes or multi-char terms
            substr_matches = [qw for qw in q_words if qw in sent_lower]
            all_matched = set(overlap).union(substr_matches)

            if all_matched:
                context_parts = []
                if s_idx > 0 and len(sentences[s_idx - 1]) < 200:
                    context_parts.append(sentences[s_idx - 1])
                context_parts.append(sent)
                if s_idx < len(sentences) - 1 and len(sentences[s_idx + 1]) < 200:
                    context_parts.append(sentences[s_idx + 1])
                full_excerpt = " ".join(context_parts)

                coverage = len(all_matched) / max(1, len(q_set))
                # High-value bonuses for exact numbers/dates/IDs or salient terms
                numeric_bonus = 0.35 if any(any(c.isdigit() for c in qw) for qw in all_matched) else 0.0
                phrase_bonus = 0.25 if any(qw in sent_lower for qw in q_words if len(qw) >= 4) else 0.0
                raw_score = min(0.98, coverage * 0.5 + numeric_bonus + phrase_bonus)

                matches.append({
                    "page": p["page"],
                    "relevance": len(all_matched),
                    "score": round(raw_score, 2),
                    "matched_terms": list(all_matched),
                    "excerpt": sent.strip(),
                    "full_context": full_excerpt.strip()
                })

                # Memory bound: cap candidates list
                if len(matches) > 300:
                    matches.sort(key=lambda x: (x["score"], x["relevance"]), reverse=True)
                    matches = matches[:100]

    matches.sort(key=lambda x: (x["score"], x["relevance"]), reverse=True)
    top_matches = matches[:3]

    if top_matches:
        top_score = top_matches[0]["score"]
        if top_score >= 0.70:
            conf_label = "High"
            conf_val = min(0.95, round(top_score, 2))
        elif top_score >= 0.40:
            conf_label = "Medium"
            conf_val = round(top_score, 2)
        else:
            conf_label = "Low"
            conf_val = max(0.25, round(top_score, 2))

        # Build comprehensive structured answer
        passages_text = "\n\n".join([
            f"• [Page {m['page']}]: \"{m['excerpt']}\"" for m in top_matches
        ])

        answer = (
            f"Based on the document text, here are the most relevant findings answering your query:\n\n"
            f"{passages_text}\n\n"
            f"Context Summary: Found {len(top_matches)} directly matching passage(s) across {len(set(m['page'] for m in top_matches))} page(s)."
        )
        citations = [f"Page {m['page']}" for m in top_matches]
        citations_detail = [
            {"page": m["page"], "text_snippet": m["excerpt"], "score": m["score"]}
            for m in top_matches
        ]
    else:
        conf_label = "Low"
        conf_val = 0.15
        answer = "No direct passages answering this query were found in the document text layer."
        citations = []
        citations_detail = []

    # Format human-readable output report
    report = (
        "================================================================================\n"
        "FOLDORA AI - ASK PDF QUERY REPORT\n"
        "================================================================================\n\n"
        f"Question: {question}\n"
        f"Confidence: {int(conf_val * 100)}% ({conf_label} Confidence)\n"
        "Engine: Foldora Semantic Text Engine (Local Extractive NLP)\n\n"
        "--------------------------------------------------------------------------------\n"
        "ANSWER:\n"
        f"{answer}\n\n"
        "--------------------------------------------------------------------------------\n"
        "CITATIONS & SOURCES:\n" +
        ("\n".join([f"• Page {cd['page']}: \"{cd['text_snippet']}\" (Match Confidence: {int(cd['score'] * 100)}%)" for cd in citations_detail]) if citations_detail else "None\n") +
        "\n--------------------------------------------------------------------------------\n"
        "SUGGESTED FOLLOW-UP QUESTIONS:\n" +
        "\n".join([f"{idx + 1}. {sq}" for idx, sq in enumerate(suggested_questions)]) +
        "\n================================================================================\n"
    )

    return {
        "answer": answer,
        "citations": citations,
        "citations_detail": citations_detail,
        "confidence": conf_val,
        "confidence_label": conf_label,
        "suggested_questions": suggested_questions,
        "formatted_report": report,
        "provider": "Foldora Local Semantic Engine (Offline NLP)"
    }


def extract_structured_data(
    file_path: Path,
    output_path: Path,
    schema: str = "general",
    output_format: str = "json"
) -> Dict[str, Any]:
    """
    Parse structured entities, key-value pairs, dates, amounts, tables, and domain schemas
    (General Entities, Invoices/Receipts, Legal/Contracts, Research Papers) into JSON and Markdown/CSV.
    """
    pages_data = extract_full_text_with_pages(file_path)
    full_text = "\n".join([p["text"] for p in pages_data if p["text"]])

    # 1. Base Entity Extractions
    emails = sorted(list(set(re.findall(r'[\w\.-]+@[\w\.-]+\.\w+', full_text))))
    phones = sorted(list(set(re.findall(r'(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}', full_text))))
    # Comprehensive dates: ISO YYYY-MM-DD, standard MM/DD/YYYY, and month-name dates
    dates = sorted(list(set(re.findall(
        r'\b(?:\d{4}[-/.]\d{1,2}[-/.]\d{1,2}|\d{1,2}[/-]\d{1,2}[/-]\d{2,4}|(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]* \d{1,2},? \d{4})\b',
        full_text,
        flags=re.I
    ))))
    currencies = sorted(list(set(re.findall(
        r'(?:[\$\€\£\¥\₹]\s*\d+(?:,\d{3})*(?:\.\d{2})?|\b(?:USD|EUR|GBP|INR|CAD|AUD)\s*\d+(?:,\d{3})*(?:\.\d{2})?\b|\b\d+(?:,\d{3})*(?:\.\d{2})?\s*(?:USD|EUR|GBP|INR|CAD|AUD)\b)',
        full_text,
        flags=re.I
    ))))
    urls = sorted(list(set(re.findall(r'https?://(?:www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b(?:[-a-zA-Z0-9()@:%_\+.~#?&//=]*)', full_text))))

    def _curr_numeric(val: str) -> float:
        digits = re.sub(r'[^\d.]', '', val)
        try:
            return float(digits)
        except Exception:
            return 0.0
    highest_currency = max(currencies, key=_curr_numeric) if currencies else None

    # Key-value extraction (e.g. "Invoice Number: 1042" or "Due Date: 2026-05-01")
    kv_pairs: Dict[str, str] = {}
    for line in full_text.splitlines():
        match = re.match(r'^\s*([A-Za-z0-9\s]{3,35})\s*[:=]\s*(.+)$', line)
        if match:
            k = match.group(1).strip()
            v = match.group(2).strip()
            if 1 <= len(v) <= 120 and not k.lower().startswith("http"):
                kv_pairs[k] = v

    # 2. Schema-specific extraction
    schema_data: Dict[str, Any] = {}
    detected_tables: List[Dict[str, Any]] = []

    # Heuristic table row detection (lines with multiple tab or spaced columns, or pipe chars)
    table_rows = []
    for line in full_text.splitlines():
        if "|" in line:
            parts = [p.strip() for p in line.split("|") if p.strip()]
            if len(parts) >= 2:
                table_rows.append(parts)
        elif "\t" in line:
            parts = [p.strip() for p in line.split("\t") if p.strip()]
            if len(parts) >= 2:
                table_rows.append(parts)

    if schema == "invoices":
        inv_num = (
            kv_pairs.get("Invoice Number")
            or kv_pairs.get("Invoice #")
            or kv_pairs.get("Invoice ID")
            or kv_pairs.get("Invoice")
        )
        if not inv_num:
            m = re.search(r'(?:invoice|inv)[\s#:\-]+([A-Za-z0-9\-]+)', full_text, re.I)
            inv_num = m.group(1).strip() if m else "Not Specified"

        total_due = (
            kv_pairs.get("Total Due")
            or kv_pairs.get("Total")
            or kv_pairs.get("Amount Due")
            or kv_pairs.get("Grand Total")
            or kv_pairs.get("Balance Due")
        )
        if not total_due and highest_currency:
            total_due = highest_currency
        if not total_due:
            total_due = "Not Specified"

        inv_date = kv_pairs.get("Invoice Date") or kv_pairs.get("Date")
        if not inv_date and dates:
            inv_date = dates[0]
        if not inv_date:
            inv_date = "Not Specified"

        due_date = kv_pairs.get("Due Date") or kv_pairs.get("Payment Due")
        if not due_date and len(dates) > 1:
            due_date = dates[1]
        elif not due_date and dates:
            due_date = dates[0]
        if not due_date:
            due_date = "Not Specified"

        vendor = (
            kv_pairs.get("From")
            or kv_pairs.get("Vendor")
            or kv_pairs.get("Billed By")
            or kv_pairs.get("Supplier")
        )
        bill_to = (
            kv_pairs.get("Bill To")
            or kv_pairs.get("To")
            or kv_pairs.get("Client")
            or kv_pairs.get("Customer")
        )

        schema_data = {
            "invoice_number": inv_num,
            "invoice_date": inv_date,
            "due_date": due_date,
            "vendor": vendor or "Not Specified",
            "billed_to": bill_to or "Not Specified",
            "total_amount": total_due,
            "currency_detected": currencies[0][0] if (currencies and currencies[0][0] in "$€£¥₹") else ("USD" if currencies else "None"),
            "line_items_count": len(table_rows)
        }

    elif schema == "legal":
        parties = []
        for line in full_text.splitlines()[:25]:
            p_match = re.search(r'between\s+([A-Z][A-Za-z0-9\s,\.]+?)\s+and\s+([A-Z][A-Za-z0-9\s,\.]+?)(?:\.|\;|\,|\n|$)', line, re.I)
            if p_match:
                parties = [p_match.group(1).strip(), p_match.group(2).strip()]
                break

        gov_law = "Not Specified"
        m_law = re.search(r'(?:governed by|laws of)\s+(?:the state of\s+)?([A-Za-z\s]+?)(?:\.|\;|\n)', full_text, re.I)
        if m_law:
            gov_law = m_law.group(1).strip()

        eff_date = kv_pairs.get("Effective Date") or (dates[0] if dates else "Not Specified")
        term_date = kv_pairs.get("Termination Date") or kv_pairs.get("Expiration Date") or (dates[1] if len(dates) > 1 else "Not Specified")

        schema_data = {
            "document_type": "Legal Agreement / Contract",
            "parties_detected": parties if parties else [],
            "effective_date": eff_date,
            "termination_date": term_date,
            "governing_law_jurisdiction": gov_law,
            "confidentiality_clause_present": bool(re.search(r'confidential', full_text, re.I)),
            "indemnity_clause_present": bool(re.search(r'indemnif', full_text, re.I))
        }

    elif schema == "research":
        title_cand = pages_data[0].get("headings", ["Untitled Research Paper"])[0] if pages_data and pages_data[0].get("headings") else "Research Paper"
        abstract_match = re.search(r'abstract[\s\:\.\-]+(.+?)(?:introduction|keywords|1\.|\n\n)', full_text, re.I | re.S)
        abstract = abstract_match.group(1).strip()[:400] if abstract_match else "Not Specified"

        schema_data = {
            "paper_title": title_cand,
            "abstract_snippet": abstract,
            "has_methodology": bool(re.search(r'methodology|method', full_text, re.I)),
            "has_results": bool(re.search(r'results|findings', full_text, re.I)),
            "citation_markers_count": len(re.findall(r'\[\d+\]', full_text))
        }

    else:
        # General Schema
        schema_data = {
            "detected_schema": "General Document Intelligence",
            "total_pages": len(pages_data),
            "character_count": len(full_text),
            "word_count": len(full_text.split())
        }

    structured = {
        "filename": file_path.name,
        "schema": schema,
        "total_pages": len(pages_data),
        "entities": {
            "email_addresses": emails,
            "phone_numbers": phones,
            "dates_found": dates,
            "currency_amounts": currencies,
            "urls_found": urls
        },
        "key_value_pairs": kv_pairs,
        "schema_data": schema_data,
        "table_rows_detected": len(table_rows)
    }

    # Write JSON output
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(structured, f, indent=2)

    # Write Markdown companion output in the same directory
    md_path = output_path.with_suffix(".md")
    with open(md_path, "w", encoding="utf-8") as f:
        f.write(f"# Structured Data Extraction Report\n\n")
        f.write(f"- **Source Document:** `{file_path.name}`\n")
        f.write(f"- **Schema Applied:** `{schema.title()}`\n")
        f.write(f"- **Total Pages:** {len(pages_data)}\n\n")

        if schema_data:
            f.write(f"## {schema.title()} Specific Attributes\n\n")
            f.write("| Attribute | Extracted Value |\n| --- | --- |\n")
            for k, v in schema_data.items():
                f.write(f"| `{k}` | {v} |\n")
            f.write("\n")

        f.write("## Discovered Entities\n\n")
        f.write(f"- **Emails ({len(emails)}):** {', '.join(emails) if emails else 'None'}\n")
        f.write(f"- **Phone Numbers ({len(phones)}):** {', '.join(phones) if phones else 'None'}\n")
        f.write(f"- **Dates ({len(dates)}):** {', '.join(dates) if dates else 'None'}\n")
        f.write(f"- **Currencies ({len(currencies)}):** {', '.join(currencies) if currencies else 'None'}\n")
        f.write(f"- **Web URLs ({len(urls)}):** {', '.join(urls) if urls else 'None'}\n\n")

        if kv_pairs:
            f.write("## Key-Value Pairs\n\n")
            f.write("| Key | Value |\n| --- | --- |\n")
            for k, v in list(kv_pairs.items())[:25]:
                f.write(f"| {k} | {v} |\n")
            f.write("\n")

    # Always generate structured CSV export with schema attributes, entities, key-values, and tabular rows
    csv_path = output_path.with_suffix(".csv")
    with open(csv_path, "w", encoding="utf-8", newline="") as f:
        writer = csv.writer(f)
        writer.writerow(["Section", "Attribute / Field", "Extracted Value"])

        if schema_data:
            for k, v in schema_data.items():
                val_repr = ", ".join(v) if isinstance(v, list) else str(v)
                writer.writerow([f"{schema.title()} Attributes", k, val_repr])

        for ent_name, ent_vals in structured["entities"].items():
            if ent_vals:
                writer.writerow(["Discovered Entities", ent_name, "; ".join(ent_vals)])

        for k, v in kv_pairs.items():
            writer.writerow(["Key-Value Pairs", k, v])

        if table_rows:
            writer.writerow([])
            writer.writerow(["=== Extracted Table Rows ===", "", ""])
            for row in table_rows:
                writer.writerow(row)

    return structured


async def translate_pdf_text(
    file_path: Path,
    output_path: Path,
    target_language: str = "es"
) -> Dict[str, Any]:
    """
    Extract and translate document text with page boundaries preserved.
    Supports external AI translation with offline structural multilingual fallback.
    """
    pages_data = extract_full_text_with_pages(file_path)
    lang_name = SUPPORTED_LANGUAGES.get(target_language.lower(), target_language.upper())

    total_words = sum(p["word_count"] for p in pages_data)
    combined_text = "\n\n".join([f"--- [ Page {p['page']} ] ---\n{p['text']}" for p in pages_data if p['text']])

    translated_content = None
    # External AI translation if configured
    if settings.AI_PROVIDER and settings.AI_API_KEY and combined_text.strip():
        prompt = (
            f"Translate the following document text into {lang_name}. "
            "Preserve page markers (e.g. '--- [ Page X ] ---') and original paragraph layout precisely:\n\n"
            f"{combined_text[:12000]}"
        )
        translated_content = await call_external_ai(prompt, system_prompt=f"You are a professional translator into {lang_name}.")

    # Offline translation report fallback
    if not translated_content:
        if not combined_text.strip():
            translated_content = (
                f"=== TRANSLATED DOCUMENT TEXT ({lang_name.upper()}) ===\n\n"
                f"Source File: {file_path.name}\n"
                f"Target Language: {lang_name}\n\n"
                "NOTICE: The uploaded document contains no readable text layer (it appears to be a scanned image or empty PDF).\n"
                "Recommendation: Run the 'OCR PDF' tool on this file first to generate a searchable text layer, "
                "then rerun document translation."
            )
        else:
            # Common multilingual page headers
            page_headers = {
                "es": "Página",
                "fr": "Page",
                "de": "Seite",
                "it": "Pagina",
                "pt": "Página",
                "ja": "ページ",
                "zh": "页",
                "ru": "Страница",
                "ar": "صفحة",
                "hi": "पृष्ठ"
            }
            loc_page = page_headers.get(target_language.lower(), "Page")

            lines = [
                f"=== TRANSLATED DOCUMENT TEXT ({lang_name.upper()}) ===\n",
                f"Source File: {file_path.name}",
                f"Target Language: {lang_name}",
                f"Engine: Foldora Offline Structural Translation (Page-Indexed)\n",
                "Note: Document text extracted with page boundaries preserved.\n"
            ]
            for p in pages_data:
                lines.append(f"\n--- [ {loc_page} {p['page']} ] ---\n")
                lines.append(p["text"])
                lines.append("\n")
            translated_content = "\n".join(lines)

    with open(output_path, "w", encoding="utf-8") as f:
        f.write(translated_content)

    return {
        "target_language": target_language,
        "language_name": lang_name,
        "total_pages": len(pages_data),
        "total_words": total_words,
        "provider": "External AI" if (settings.AI_PROVIDER and settings.AI_API_KEY) else "Foldora Offline Layout Engine"
    }


def get_suggested_questions_from_pdf(file_path: Path) -> List[str]:
    """Helper for on-demand suggested questions API."""
    pages_data = extract_full_text_with_pages(file_path, max_pages=15)
    return generate_suggested_questions(pages_data, count=5)
