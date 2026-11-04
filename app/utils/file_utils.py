import shutil
import zipfile
import logging
from pathlib import Path
from typing import List, Tuple, Optional
from app.core.config import settings
from app.core.security import validate_job_id, sanitize_filename

logger = logging.getLogger("foldora.file_utils")


def get_job_dir(job_id: str, create: bool = True) -> Path:
    """
    Safely resolve and create a job-specific working directory.
    Strictly verifies path containment inside settings.storage_path.
    If create=False, directory is not created on disk (prevents inode exhaustion DoS).
    """
    clean_id = validate_job_id(job_id)
    storage_root = settings.storage_path.resolve()
    job_dir = (storage_root / clean_id).resolve()

    if not job_dir.is_relative_to(storage_root) or job_dir == storage_root:
        raise ValueError(f"Path traversal attempt: job directory resolves outside storage path")

    if create:
        job_dir.mkdir(parents=True, exist_ok=True)
    return job_dir


def cleanup_directory(path: Path) -> bool:
    """
    Clean up a directory only if it is strictly contained within settings.storage_path.
    Prevents accidental or malicious deletion of system directories.
    """
    try:
        resolved = path.resolve()
        storage_root = settings.storage_path.resolve()

        if not resolved.is_relative_to(storage_root) or resolved == storage_root:
            logger.warning("Attempted cleanup of directory outside storage root: %s", path)
            return False

        if resolved.exists() and resolved.is_dir():
            shutil.rmtree(resolved, ignore_errors=True)
            logger.info("Cleaned up directory: %s", resolved)
            return True
    except Exception as exc:
        logger.error("Failed to clean up directory %s: %s", path, exc)
    return False


def format_bytes(num_bytes: int) -> str:
    if num_bytes < 1024:
        return f"{num_bytes} B"
    elif num_bytes < 1024 * 1024:
        return f"{num_bytes / 1024:.1f} KB"
    elif num_bytes < 1024 * 1024 * 1024:
        return f"{num_bytes / (1024 * 1024):.1f} MB"
    else:
        return f"{num_bytes / (1024 * 1024 * 1024):.2f} GB"


def create_zip_archive(zip_path: Path, file_items: List[Tuple[Path, str]]) -> Path:
    """
    Pack a list of (file_path, arcname) into a standard zip archive.
    Sanitizes arcnames to prevent Zip Slip entries in generated archives.
    """
    zip_resolved = zip_path.resolve()
    storage_root = settings.storage_path.resolve()
    if not zip_resolved.is_relative_to(storage_root):
        raise ValueError("ZIP archive destination resolves outside storage path")

    with zipfile.ZipFile(zip_resolved, 'w', zipfile.ZIP_DEFLATED) as zf:
        for fpath, arcname in file_items:
            if fpath.exists():
                safe_arcname = sanitize_filename(arcname)
                zf.write(fpath, safe_arcname)
    return zip_resolved


def validate_zip_bomb(
    file_path: Path,
    max_ratio: float = 100.0,
    max_uncompressed_bytes: int = 150 * 1024 * 1024,
    max_files: int = 1000
) -> None:
    """
    Inspect a ZIP/Office archive to verify it is not a decompression bomb.
    Checks uncompressed size ratio and absolute uncompressed size limits.
    Also inspects XML members for embedded XXE entities.
    """
    if not zipfile.is_zipfile(file_path):
        suffix = file_path.suffix.lower()
        if suffix in (".docx", ".xlsx", ".pptx", ".zip"):
            raise ValueError(f"File '{file_path.name}' is not a valid ZIP/Office archive")
        return

    compressed_size = max(1, file_path.stat().st_size)
    total_uncompressed = 0
    file_count = 0

    with zipfile.ZipFile(file_path, 'r') as zf:
        infolist = zf.infolist()
        if len(infolist) > max_files:
            raise ValueError(f"Archive contains {len(infolist)} files, exceeding safety limit of {max_files}")

        for info in infolist:
            file_count += 1
            total_uncompressed += info.file_size
            if total_uncompressed > max_uncompressed_bytes:
                raise ValueError(
                    f"Decompression bomb detected: uncompressed size exceeds limit of {max_uncompressed_bytes // (1024 * 1024)} MB"
                )

            # Check for embedded XXE declarations in Office XML members
            if info.filename.lower().endswith((".xml", ".rels")) and info.file_size > 0:
                with zf.open(info) as f_xml:
                    snippet = f_xml.read(4096).decode("utf-8", errors="ignore").lower()
                    if "<!entity" in snippet or ("<!doctype" in snippet and ("system" in snippet or "public" in snippet)):
                        raise ValueError(f"XXE payload detected in archive member: {info.filename}")

    ratio = total_uncompressed / compressed_size
    if ratio > max_ratio and total_uncompressed > 10 * 1024 * 1024:
        raise ValueError(
            f"Decompression bomb detected: compression ratio {ratio:.1f}:1 exceeds safety threshold of {max_ratio}:1"
        )


def safe_extract_zip(
    zip_path: Path,
    target_dir: Path,
    max_files: int = 500,
    max_total_bytes: int = 100 * 1024 * 1024
) -> List[Path]:
    """
    Safely extract a ZIP archive protecting against Zip Slip path traversal,
    decompression bombs, symlink attacks, and null byte injections.
    """
    validate_zip_bomb(zip_path, max_uncompressed_bytes=max_total_bytes, max_files=max_files)
    target_resolved = target_dir.resolve()
    extracted_files: List[Path] = []

    with zipfile.ZipFile(zip_path, 'r') as zf:
        for member in zf.infolist():
            if "\x00" in member.filename:
                raise ValueError(f"Null byte detected in ZIP member: {member.filename}")

            dest_file = (target_resolved / member.filename).resolve()
            if not dest_file.is_relative_to(target_resolved) or dest_file == target_resolved:
                raise ValueError(f"Zip Slip path traversal attempt blocked: {member.filename}")

            if dest_file.is_symlink():
                raise ValueError(f"Symlink target detected: {member.filename}")

            if member.is_dir():
                dest_file.mkdir(parents=True, exist_ok=True)
            else:
                dest_file.parent.mkdir(parents=True, exist_ok=True)
                with zf.open(member) as source, open(dest_file, "wb") as target:
                    shutil.copyfileobj(source, target)
                extracted_files.append(dest_file)

    return extracted_files

