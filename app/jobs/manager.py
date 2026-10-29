import asyncio
from datetime import datetime, timezone, timedelta
import logging
from pathlib import Path
from typing import Dict, Optional, List
from app.jobs.models import Job, JobStatus, OutputFile
from app.core.config import settings
from app.core.security import generate_job_id, generate_download_token
from app.utils.file_utils import get_job_dir, cleanup_directory

logger = logging.getLogger("foldora.jobs")


class JobManager:
    def __init__(self):
        self._jobs: Dict[str, Job] = {}
        self._semaphore = asyncio.Semaphore(settings.MAX_CONCURRENT_JOBS)
        self._cleanup_task: Optional[asyncio.Task] = None
        self._lock = asyncio.Lock()

    def _save_job_to_disk(self, job: Job) -> None:
        try:
            job_dir = get_job_dir(job.id)
            meta_path = job_dir / "job.json"
            meta_path.write_text(job.model_dump_json(), encoding="utf-8")
        except Exception as e:
            logger.warning("Could not persist job %s to disk: %s", job.id, e)

    def _load_job_from_disk(self, job_id: str) -> Optional[Job]:
        try:
            job_dir = get_job_dir(job_id)
            meta_path = job_dir / "job.json"
            if meta_path.exists():
                import json
                data = json.loads(meta_path.read_text(encoding="utf-8"))
                job = Job(**data)
                self._jobs[job_id] = job
                return job
        except Exception as e:
            logger.warning("Could not load job %s from disk: %s", job_id, e)
        return None

    def create_job(self, tool_id: str, options: dict) -> Job:
        job_id = generate_job_id()
        download_token = generate_download_token()
        now = datetime.now(timezone.utc)
        expires_at = now + timedelta(minutes=settings.JOB_TTL_MINUTES)

        job = Job(
            id=job_id,
            tool_id=tool_id,
            status=JobStatus.QUEUED,
            progress=0,
            message="Job queued for processing",
            created_at=now,
            updated_at=now,
            expires_at=expires_at,
            download_token=download_token,
            options=options
        )
        # Ensure job storage directory exists
        get_job_dir(job_id)
        self._jobs[job_id] = job
        self._save_job_to_disk(job)
        logger.info("Created job %s for tool %s", job_id, tool_id)
        return job

    def get_job(self, job_id: str) -> Optional[Job]:
        job = self._jobs.get(job_id)
        if not job:
            job = self._load_job_from_disk(job_id)
        return job

    def update_job(
        self,
        job_id: str,
        status: Optional[JobStatus] = None,
        progress: Optional[int] = None,
        message: Optional[str] = None,
        error: Optional[str] = None,
        output_files: Optional[List[OutputFile]] = None,
        metadata: Optional[dict] = None
    ) -> Optional[Job]:
        job = self._jobs.get(job_id)
        if not job:
            return None

        now = datetime.now(timezone.utc)
        job.updated_at = now

        if status is not None:
            job.status = status
            if status == JobStatus.COMPLETED or status == JobStatus.FAILED:
                # Extend/refresh expiry from completion time
                job.expires_at = now + timedelta(minutes=settings.JOB_TTL_MINUTES)
        if progress is not None:
            job.progress = max(0, min(100, progress))
        if message is not None:
            job.message = message
        if error is not None:
            job.error = error
        if output_files is not None:
            job.output_files = output_files
        if metadata is not None:
            job.metadata.update(metadata)

        self._save_job_to_disk(job)
        return job

    def cancel_job(self, job_id: str) -> bool:
        job = self._jobs.get(job_id)
        if not job:
            return False
        if job.status in [JobStatus.COMPLETED, JobStatus.FAILED, JobStatus.EXPIRED]:
            return False
        job.status = JobStatus.CANCELLED
        job.message = "Job cancelled by user"
        job.updated_at = datetime.now(timezone.utc)
        logger.info("Cancelled job %s", job_id)
        return True

    def delete_job(self, job_id: str) -> bool:
        job = self._jobs.pop(job_id, None)
        job_dir = settings.storage_path / job_id
        cleanup_directory(job_dir)
        logger.info("Deleted job %s and removed temporary files", job_id)
        return job is not None

    async def acquire_slot(self):
        """Bounded worker concurrency limit."""
        await self._semaphore.acquire()

    def release_slot(self):
        self._semaphore.release()

    async def cleanup_expired_jobs(self):
        """Scans for expired jobs and purges their storage."""
        now = datetime.now(timezone.utc)
        expired_ids = []
        for jid, job in list(self._jobs.items()):
            if job.expires_at and job.expires_at < now:
                expired_ids.append(jid)

        for jid in expired_ids:
            logger.info("Expiring job %s after TTL expiration", jid)
            self.delete_job(jid)

        # Also purge any orphaned directories in temp storage older than 1 hour
        try:
            storage_root = settings.storage_path
            if storage_root.exists():
                one_hour_ago = datetime.now().timestamp() - 3600
                for item in storage_root.iterdir():
                    if item.is_dir() and item.stat().st_mtime < one_hour_ago:
                        if item.name not in self._jobs:
                            cleanup_directory(item)
        except Exception as exc:
            logger.warning("Error during orphan folder cleanup: %s", exc)

    async def start_cleanup_loop(self):
        while True:
            try:
                await asyncio.sleep(settings.CLEANUP_INTERVAL_SECONDS)
                await self.cleanup_expired_jobs()
            except asyncio.CancelledError:
                break
            except Exception as exc:
                logger.error("Error in job cleanup loop: %s", exc)


job_manager = JobManager()
