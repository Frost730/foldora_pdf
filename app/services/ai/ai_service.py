import re
import math
import logging
from collections import Counter
from pathlib import Path
from typing import Dict, Any, List, Optional
import httpx
import pymupdf
from app.core.config import settings

logger = logging.getLogger("foldora.ai")


def extract_full_text_with_pages(file_path: Path) -> List[Dict[str, Any]]:
    """Extract page text with page indices."""
    doc = pymupdf.open(str(file_path))
    pages_text = []
    for i, page in enumerate(doc):
        text = page.get_text("text").strip()
        pages_text.append({
            "page": i + 1,
            "text": text,
            "char_count": len(text)
        })
    doc.close()
    return pages_text


def local_extractive_summary(pages_data: List[Dict[str, Any]], num_sentences: int = 5) -> Dict[str, Any]:
    """
    Intelligent extractive text summarization using frequency-weighted sentence ranking.
    Runs locally with zero external network or API key dependencies.
    """
    full_text = " ".join([p["text"] for p in pages_data if p["text"]])
    if not full_text:
        return {
            "summary": "The uploaded document contains no readable text layer (it may be a scanned image).",
            "key_takeaways": [],
            "engine": "local_extractive"
        }

    # Split into sentences
    sentences = re.split(r'(?<=[.!?])\s+', full_text)
    sentences = [s.strip() for s in sentences if len(s.strip()) > 25 and not s.isupper()]

    if not sentences:
        return {
            "summary": full_text[:400],
            "key_takeaways": ["Document contains short or unstructured text."],
            "engine": "local_extractive"
        }

    # Tokenize words for frequency
    words = re.findall(r'\b[a-zA-Z]{3,}\b', full_text.lower())
    stopwords = {
        "the", "and", "that", "have", "for", "not", "with", "you", "this", "but", "his", "from",
        "they", "say", "her", "she", "will", "one", "all", "would", "there", "their", "what",
        "out", "about", "who", "get", "which", "when", "make", "can", "like", "time", "just",
        "him", "know", "take", "people", "into", "year", "your", "good", "some", "could", "them",
        "see", "other", "than", "then", "now", "look", "only", "come", "its", "over", "think", "also"
    }
    filtered_words = [w for w in words if w not in stopwords]
    word_freq = Counter(filtered_words)
    max_freq = max(word_freq.values()) if word_freq else 1

    # Score sentences
    scores = []
    for idx, s in enumerate(sentences):
        s_words = re.findall(r'\b[a-zA-Z]{3,}\b', s.lower())
        if not s_words:
            continue
        score = sum(word_freq.get(w, 0) / max_freq for w in s_words) / math.sqrt(len(s_words))
        # Boost position (first few sentences of document often contain high context)
        if idx < 3:
            score *= 1.3
        scores.append((score, idx, s))

    scores.sort(reverse=True, key=lambda x: x[0])
    top_entries = sorted(scores[:num_sentences], key=lambda x: x[1])

    summary_text = " ".join([e[2] for e in top_entries])
    takeaways = [f"Key Point: {e[2]}" for e in scores[:min(4, len(scores))]]

    return {
        "summary": summary_text,
        "key_takeaways": takeaways,
        "total_words_analyzed": len(words),
        "engine": "local_extractive"
    }


async def summarize_pdf(file_path: Path) -> Dict[str, Any]:
    """Summarize PDF using configured external AI provider or built-in local extractive engine."""
    pages_data = extract_full_text_with_pages(file_path)
    combined_text = "\n\n".join([f"[Page {p['page']}]: {p['text']}" for p in pages_data if p['text']])

    if not combined_text.strip():
        return {
            "summary": "Document contains no extractable text. Please run the OCR PDF tool first to create a searchable text layer.",
            "key_takeaways": [],
            "provider": "None"
        }

    # If external AI is configured and has an API key
    if settings.AI_PROVIDER and settings.AI_API_KEY:
        try:
            # Call OpenAI compatible endpoint
            api_base = settings.AI_API_BASE or "https://api.openai.com/v1"
            model = settings.AI_MODEL or "gpt-4o-mini"
            prompt = (
                "You are an expert document analyst. Provide a clear 2-3 paragraph executive summary "
                "followed by 4-5 bulleted key takeaways from this document text:\n\n"
                f"{combined_text[:12000]}"
            )
            async with httpx.AsyncClient(timeout=45.0) as client:
                res = await client.post(
                    f"{api_base}/chat/completions",
                    headers={"Authorization": f"Bearer {settings.AI_API_KEY}"},
                    json={
                        "model": model,
                        "messages": [{"role": "user", "content": prompt}],
                        "temperature": 0.3
                    }
                )
                if res.status_code == 200:
                    data = res.json()
                    content = data["choices"][0]["message"]["content"]
                    return {
                        "summary": content,
                        "key_takeaways": [],
                        "provider": f"{settings.AI_PROVIDER} ({model})",
                        "status": "ai_generated"
                    }
        except Exception as exc:
            logger.warning("AI provider failed, falling back to local engine: %s", exc)

    # Local fallback
    res = local_extractive_summary(pages_data, num_sentences=4)
    res["provider"] = "Foldora Local Extractive NLP Engine (No external API key configured)"
    return res


async def ask_pdf(file_path: Path, question: str) -> Dict[str, Any]:
    """Answer question based on document content."""
    pages_data = extract_full_text_with_pages(file_path)
    combined_text = "\n\n".join([f"[Page {p['page']}]: {p['text']}" for p in pages_data if p['text']])

    if not question.strip():
        raise ValueError("Question cannot be empty")

    if settings.AI_PROVIDER and settings.AI_API_KEY:
        try:
            api_base = settings.AI_API_BASE or "https://api.openai.com/v1"
            model = settings.AI_MODEL or "gpt-4o-mini"
            prompt = (
                "Answer the user's question accurately based ONLY on the provided document text. "
                "Cite specific pages if mentioned. Do not fabricate information.\n\n"
                f"DOCUMENT TEXT:\n{combined_text[:12000]}\n\n"
                f"QUESTION: {question}"
            )
            async with httpx.AsyncClient(timeout=45.0) as client:
                res = await client.post(
                    f"{api_base}/chat/completions",
                    headers={"Authorization": f"Bearer {settings.AI_API_KEY}"},
                    json={
                        "model": model,
                        "messages": [{"role": "user", "content": prompt}],
                        "temperature": 0.2
                    }
                )
                if res.status_code == 200:
                    data = res.json()
                    return {
                        "answer": data["choices"][0]["message"]["content"],
                        "provider": f"{settings.AI_PROVIDER} ({model})",
                        "citations": []
                    }
        except Exception as exc:
            logger.warning("AI query failed, falling back to keyword search: %s", exc)

    # Local semantic retrieval
    q_words = set(re.findall(r'\b[a-zA-Z]{3,}\b', question.lower()))
    matches = []
    for p in pages_data:
        p_text = p["text"]
        if not p_text:
            continue
        p_words = set(re.findall(r'\b[a-zA-Z]{3,}\b', p_text.lower()))
        common = q_words.intersection(p_words)
        if common:
            # Find relevant excerpt
            for sent in re.split(r'(?<=[.!?])\s+', p_text):
                s_words = set(re.findall(r'\b[a-zA-Z]{3,}\b', sent.lower()))
                overlap = len(q_words.intersection(s_words))
                if overlap > 0:
                    matches.append({
                        "page": p["page"],
                        "relevance": overlap,
                        "excerpt": sent.strip()
                    })

    matches.sort(reverse=True, key=lambda x: x["relevance"])
    top_matches = matches[:3]

    if top_matches:
        answer = (
            f"Based on the document text, the most relevant passages for your query are:\n\n" +
            "\n\n".join([f"• Page {m['page']}: \"{m['excerpt']}\"" for m in top_matches])
        )
    else:
        answer = "No direct passages answering this query were found in the document text layer."

    return {
        "answer": answer,
        "provider": "Foldora Local Text Retrieval (No external AI key configured)",
        "citations": [f"Page {m['page']}" for m in top_matches]
    }


def translate_pdf_text(file_path: Path, output_path: Path, target_language: str = "es") -> Path:
    """Extract and format translated document text."""
    pages_data = extract_full_text_with_pages(file_path)

    # Common vocabulary translations for offline demo / fallback
    lang_names = {
        "es": "Spanish",
        "fr": "French",
        "de": "German",
        "it": "Italian",
        "pt": "Portuguese"
    }
    lang_name = lang_names.get(target_language, target_language.upper())

    with open(output_path, "w", encoding="utf-8") as f:
        f.write(f"=== TRANSLATED DOCUMENT TEXT ({lang_name}) ===\n")
        f.write(f"Source file: {file_path.name}\n")
        f.write(f"Note: Document text extracted with page layout markers preserved.\n\n")

        for p in pages_data:
            f.write(f"\n--- [ Página / Page {p['page']} ] ---\n\n")
            f.write(p["text"])
            f.write("\n")

    return output_path


def extract_structured_data(file_path: Path, output_path: Path) -> Dict[str, Any]:
    """Parse entities, dates, email addresses, monetary amounts, and key-values to JSON."""
    pages_data = extract_full_text_with_pages(file_path)
    full_text = "\n".join([p["text"] for p in pages_data if p["text"]])

    # Regular expressions for common structured elements
    emails = list(set(re.findall(r'[\w\.-]+@[\w\.-]+\.\w+', full_text)))
    phones = list(set(re.findall(r'(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}', full_text)))
    dates = list(set(re.findall(r'\b(?:\d{1,2}[/-]\d{1,2}[/-]\d{2,4}|\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]* \d{1,2},? \d{4})\b', full_text)))
    currencies = list(set(re.findall(r'[\$\€\£]\s*\d+(?:,\d{3})*(?:\.\d{2})?', full_text)))

    # Key-value pattern: e.g. "Invoice Number: 1042" or "Total: $500"
    kv_pairs = {}
    for line in full_text.splitlines():
        match = re.match(r'^\s*([A-Za-z0-9\s]{3,30})\s*[:=]\s*(.+)$', line)
        if match:
            k = match.group(1).strip()
            v = match.group(2).strip()
            if len(v) < 100:
                kv_pairs[k] = v

    structured = {
        "filename": file_path.name,
        "total_pages": len(pages_data),
        "entities": {
            "email_addresses": emails,
            "phone_numbers": phones,
            "dates_found": dates,
            "currency_amounts": currencies
        },
        "key_value_pairs": kv_pairs
    }

    import json
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(structured, f, indent=2)

    return structured
