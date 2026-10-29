import os
import re
import secrets
import subprocess
import logging
from pathlib import Path
from typing import List, Optional

logger = logging.getLogger("foldora.security")

# Magic byte signatures
MAGIC_NUMBERS = {
    "pdf": [b"%PDF-"],
    "png": [b"\x89PNG\r\n\x1a\n"],
    "jpg": [b"\xff\xd8\xff"],
    "jpeg": [b"\xff\xd8\xff"],
    "webp": [b"RIFF"],  # and WEBP at byte 8
    "tiff": [b"II*\x00", b"MM\x00*"],
    "zip_office": [b"PK\x03\x04"],  # docx, pptx, xlsx, zip
}


def generate_job_id() -> str:
    """Generate a high-entropy random job ID."""
    return f"job_{secrets.token_hex(16)}"


def generate_download_token() -> str:
    """Generate a single-use or time-bounded download verification token."""
    return secrets.token_urlsafe(32)


def sanitize_filename(filename: str, fallback_ext: str = ".bin") -> str:
    """
    Ensure the filename contains no path traversal (e.g., ../ or C:\\),
    only safe characters, and a reasonable length.
    """
    # Extract only the base name
    base = os.path.basename(filename)
    # Remove null bytes and non-printable characters
    base = re.sub(r'[\x00-\x1f\x7f]', '', base)
    # Replace any potentially dangerous characters
    clean = re.sub(r'[^a-zA-Z0-9_\-\. ]', '_', base).strip()
    if not clean or clean.startswith('.'):
        clean = f"document_{secrets.token_hex(4)}{fallback_ext}"
    # Truncate to reasonable length
    if len(clean) > 120:
        stem, ext = os.path.splitext(clean)
        clean = f"{stem[:100]}_{secrets.token_hex(2)}{ext}"
    return clean


def sniff_file_type(file_path: Path) -> str:
    """Inspect magic numbers to determine true file type."""
    if not file_path.exists() or file_path.stat().st_size == 0:
        return "empty"

    with open(file_path, "rb") as f:
        header = f.read(32)

    for ftype, signatures in MAGIC_NUMBERS.items():
        for sig in signatures:
            if header.startswith(sig):
                if ftype == "webp" and len(header) >= 12:
                    if header[8:12] == b"WEBP":
                        return "webp"
                else:
                    return ftype

    # Plain text check
    try:
        with open(file_path, "r", encoding="utf-8") as f:
            f.read(512)
        return "text"
    except Exception:
        pass

    return "unknown"


def run_safe_command(
    args: List[str],
    timeout_seconds: int = 60,
    cwd: Optional[Path] = None
) -> subprocess.CompletedProcess:
    """
    Execute an external command without shell interpolation.
    Never allows shell=True. Enforces timeouts and captures output safely.
    """
    if not args:
        raise ValueError("Command arguments cannot be empty")

    logger.debug("Executing command: %s", " ".join(args))
    try:
        proc = subprocess.run(
            args,
            shell=False,
            capture_output=True,
            text=True,
            timeout=timeout_seconds,
            cwd=cwd
        )
        return proc
    except subprocess.TimeoutExpired as exc:
        logger.warning("Command timed out after %d seconds: %s", timeout_seconds, args[0])
        raise TimeoutError(f"Process '{args[0]}' exceeded timeout limit of {timeout_seconds}s") from exc
    except FileNotFoundError as exc:
        logger.error("Command binary not found: %s", args[0])
        raise FileNotFoundError(f"Required binary '{args[0]}' is not installed or available on PATH") from exc
