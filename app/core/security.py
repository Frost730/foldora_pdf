import html
import ipaddress
import logging
import os
import re
import secrets
import socket
import subprocess
from pathlib import Path
from typing import List, Optional, Tuple
from urllib.parse import urlparse

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

JOB_ID_REGEX = re.compile(r"^[a-zA-Z0-9_\-]{8,64}$")

WINDOWS_RESERVED_NAMES = {
    "CON", "PRN", "AUX", "NUL",
    "COM1", "COM2", "COM3", "COM4", "COM5", "COM6", "COM7", "COM8", "COM9",
    "LPT1", "LPT2", "LPT3", "LPT4", "LPT5", "LPT6", "LPT7", "LPT8", "LPT9",
}


def generate_job_id() -> str:
    """Generate a high-entropy random job ID."""
    return f"job_{secrets.token_hex(16)}"


def validate_job_id(job_id: str) -> str:
    """
    Validate that job_id is strictly alphanumeric/dashes/underscores (8-64 chars).
    Prevents any path traversal or invalid character injection.
    """
    if not job_id or not isinstance(job_id, str):
        raise ValueError("Job ID must be a non-empty string")
    if not JOB_ID_REGEX.match(job_id):
        raise ValueError("Invalid job ID format: contains illegal characters or invalid length")
    if ".." in job_id or "/" in job_id or "\\" in job_id:
        raise ValueError("Path traversal sequence detected in job ID")
    return job_id


def generate_download_token() -> str:
    """Generate a single-use or time-bounded download verification token."""
    return secrets.token_urlsafe(32)


def sanitize_filename(filename: str, fallback_ext: str = ".bin") -> str:
    """
    Ensure the filename contains no path traversal (e.g., ../ or C:\\),
    no Windows reserved device names, only safe characters, and a reasonable length.
    """
    # Normalize path separators and extract only base name
    normalized = filename.replace("\\", "/")
    base = os.path.basename(normalized)

    # Remove null bytes and non-printable control characters
    base = re.sub(r'[\x00-\x1f\x7f]', '', base)

    # Replace any potentially dangerous or shell characters
    clean = re.sub(r'[^a-zA-Z0-9_\-\. ]', '_', base).strip(' .')

    # Guard against empty, leading dots, or path traversal tokens
    if not clean or clean.startswith('.') or clean == "..":
        clean = f"document_{secrets.token_hex(4)}{fallback_ext}"

    # Guard against Windows reserved names (e.g., CON.txt, CON.tar.gz, NUL, AUX, etc.)
    stem, ext = os.path.splitext(clean)
    primary_stem = clean.split('.')[0]
    if stem.upper() in WINDOWS_RESERVED_NAMES or primary_stem.upper() in WINDOWS_RESERVED_NAMES:
        clean = f"doc_{stem}_{secrets.token_hex(2)}{ext}"

    # Truncate to reasonable length preserving extension
    if len(clean) > 120:
        clean = f"{stem[:100]}_{secrets.token_hex(2)}{ext}"

    return clean


def sniff_file_type(file_path: Path) -> str:
    """Inspect magic numbers to determine true file type."""
    if not file_path.exists() or file_path.stat().st_size == 0:
        return "empty"

    try:
        with open(file_path, "rb") as f:
            header = f.read(32)
    except Exception:
        return "unknown"

    for ftype, signatures in MAGIC_NUMBERS.items():
        for sig in signatures:
            if header.startswith(sig):
                if ftype == "webp" and len(header) >= 12:
                    if header[8:12] == b"WEBP":
                        return "webp"
                else:
                    return ftype

    # Plain text / HTML check
    try:
        with open(file_path, "r", encoding="utf-8") as f:
            snippet = f.read(512)
            low = snippet.lower()
            if "<!doctype html" in low or "<html" in low:
                return "html"
        return "text"
    except Exception:
        pass

    return "unknown"


# Commonly exploited ports that must not be reached via SSRF
DANGEROUS_PORTS = {
    21, 22, 23, 25, 53, 69, 110, 111, 135, 137, 138, 139, 143,
    445, 512, 513, 514, 1433, 1521, 2049, 2375, 2376, 3306,
    3389, 5432, 5900, 6379, 11211, 27017
}


def is_safe_url(url: str, allow_internal: bool = False) -> Tuple[bool, str]:
    """
    Validate that a URL is safe to fetch and does not point to internal/private IP ranges
    (RFC 1918, loopback, link-local, cloud metadata service 169.254.169.254) or dangerous ports.
    Prevents Server-Side Request Forgery (SSRF).
    """
    try:
        parsed = urlparse(url)
    except Exception:
        return False, "Malformed URL"

    if parsed.scheme.lower() not in ("http", "https"):
        return False, f"Prohibited URL scheme: '{parsed.scheme}'. Only http and https are allowed."

    hostname = parsed.hostname
    if not hostname:
        return False, "Missing hostname in URL"

    if parsed.port and parsed.port in DANGEROUS_PORTS:
        return False, f"Prohibited port: {parsed.port}"

    hostname_low = hostname.lower()
    if hostname_low in ("localhost", "0.0.0.0", "instance-data", "metadata.google.internal") or hostname_low.endswith(".localhost"):
        return False, f"Prohibited loopback/metadata host: '{hostname}'"

    # Check for direct IP literal
    try:
        ip_obj = ipaddress.ip_address(hostname)
        if not allow_internal:
            if (
                ip_obj.is_private
                or ip_obj.is_loopback
                or ip_obj.is_link_local
                or ip_obj.is_reserved
                or ip_obj.is_multicast
                or ip_obj.is_unspecified
            ):
                return False, f"Prohibited private or reserved IP address: {hostname}"
        return True, "Safe URL"
    except ValueError:
        pass  # Hostname is a domain name, not an IP literal

    # Resolve domain via DNS and verify that none of the resolved IPs are private/reserved
    if not allow_internal:
        try:
            target_port = parsed.port or (443 if parsed.scheme == "https" else 80)
            addr_info = socket.getaddrinfo(hostname, target_port)
            for item in addr_info:
                ip_str = item[4][0]
                ip_obj = ipaddress.ip_address(ip_str)
                if (
                    ip_obj.is_private
                    or ip_obj.is_loopback
                    or ip_obj.is_link_local
                    or ip_obj.is_reserved
                    or ip_obj.is_multicast
                    or ip_obj.is_unspecified
                ):
                    return False, f"Domain '{hostname}' resolves to prohibited internal IP: {ip_str}"
        except socket.gaierror as e:
            return False, f"Cannot resolve domain '{hostname}': {e}"
        except Exception as e:
            return False, f"DNS resolution check error for '{hostname}': {e}"

    return True, "Safe URL"


def sanitize_html_content(content: str) -> str:
    """
    Sanitize HTML input for safe conversion:
    1. Strip XML declarations (<?xml...?>) and processing instructions.
    2. Strip DTD / <!DOCTYPE declarations with SYSTEM/PUBLIC entities or external DTDs.
    3. Block XML external entity declarations (XXE: <!ENTITY...>).
    4. Strip dangerous tags and their content: <script>, <iframe>, <object>, <embed>, <meta>, <link>, <base>, <form>, <input>, <applet>, <frame>, <frameset>.
    5. Strip on* event handlers (e.g. onload, onerror).
    6. Block prohibited URI schemes in any attribute (javascript:, vbscript:, file:, data:text/html).
    7. Neutralize dangerous CSS in style attributes (e.g. expression(), behavior:).
    Repeats tag stripping across multiple passes to prevent nested tag reconstitution.
    """
    if not content:
        return ""

    # Strip XML declarations & processing instructions
    content = re.sub(r'<\?[^>]*\?>', '', content, flags=re.DOTALL)

    # Strip ENTITY declarations
    content = re.sub(r'<!ENTITY\b[^>]*>', '', content, flags=re.IGNORECASE | re.DOTALL)

    # Strip or normalize complex/external DOCTYPE declarations
    content = re.sub(r'<!DOCTYPE\b[^>]*\[.*?\]\s*>', '<!DOCTYPE html>', content, flags=re.IGNORECASE | re.DOTALL)
    if "<!doctype" in content.lower():
        content = re.sub(r'<!DOCTYPE\b[^>]*>', '<!DOCTYPE html>', content, flags=re.IGNORECASE | re.DOTALL)

    # Strip external stylesheet links
    content = re.sub(r'<link\b[^>]*>', '', content, flags=re.IGNORECASE)

    # Strip dangerous tags and their content (multi-pass to defeat nested tags)
    dangerous_tags = [
        "script", "iframe", "object", "embed", "applet",
        "meta", "base", "form", "frame", "frameset"
    ]
    for _ in range(3):
        for tag in dangerous_tags:
            pattern = rf'<{tag}\b[^>]*>.*?</{tag}>'
            content = re.sub(pattern, '', content, flags=re.IGNORECASE | re.DOTALL)
            content = re.sub(rf'<{tag}\b[^>]*\/?>', '', content, flags=re.IGNORECASE)

    # Strip on* event handlers (e.g. onload=..., onerror=...)
    content = re.sub(r'\bon[a-zA-Z]+\s*=\s*("[^"]*"|\'[^\']*\'|[^\s>]+)', '', content, flags=re.IGNORECASE)

    # Strip dangerous schemes in any attribute
    dangerous_attr_schemes = r'(href|src|action|xlink:href|formaction|data|poster|background)\s*=\s*["\']?\s*(javascript|vbscript|file|data\s*:\s*text\/html):[^"\'\s>]*["\']?'
    content = re.sub(dangerous_attr_schemes, '', content, flags=re.IGNORECASE)

    # Strip dangerous CSS expressions in style attributes
    content = re.sub(r'style\s*=\s*["\'][^"\']*(?:expression|behavior|-moz-binding)[^"\']*["\']', '', content, flags=re.IGNORECASE)

    return content


def run_safe_command(
    args: List[str],
    timeout_seconds: int = 60,
    cwd: Optional[Path] = None
) -> subprocess.CompletedProcess:
    """
    Execute an external command without shell interpolation.
    Never allows shell=True. Enforces timeouts and captures output safely.
    Validates arguments against null bytes and illegal types.
    """
    if not args or not isinstance(args, list):
        raise ValueError("Command arguments must be a non-empty list of strings")

    for i, arg in enumerate(args):
        if not isinstance(arg, str):
            raise TypeError(f"Command argument at index {i} must be str, got {type(arg)}")
        if '\0' in arg:
            raise ValueError(f"Command argument at index {i} contains forbidden null byte")

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

