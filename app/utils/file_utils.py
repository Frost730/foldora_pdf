import shutil
import zipfile
import logging
from pathlib import Path
from typing import List, Tuple
from app.core.config import settings

logger = logging.getLogger("foldora.file_utils")


def get_job_dir(job_id: str) -> Path:
    job_dir = settings.storage_path / job_id
    job_dir.mkdir(parents=True, exist_ok=True)
    return job_dir


def cleanup_directory(path: Path) -> bool:
    try:
        if path.exists() and path.is_dir():
            shutil.rmtree(path, ignore_errors=True)
            logger.info("Cleaned up directory: %s", path)
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
    """
    with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as zf:
        for fpath, arcname in file_items:
            if fpath.exists():
                zf.write(fpath, arcname)
    return zip_path
