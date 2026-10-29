from pathlib import Path
import tempfile
from typing import List, Optional
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore"
    )

    APP_NAME: str = "Foldora PDF"
    APP_VERSION: str = "1.0.0"
    ENVIRONMENT: str = "production"
    DEBUG: bool = False

    HOST: str = "0.0.0.0"
    PORT: int = 8000

    # Operational limits
    MAX_UPLOAD_MB: int = 50
    MAX_FILES_PER_JOB: int = 20
    MAX_PAGES_PER_JOB: int = 200
    MAX_CONCURRENT_JOBS: int = 5
    JOB_TTL_MINUTES: int = 15
    MAX_PROCESSING_SECONDS: int = 180
    CLEANUP_INTERVAL_SECONDS: int = 60

    # Storage
    TEMP_DIR: Optional[str] = None

    # AI configuration
    AI_PROVIDER: Optional[str] = None  # "openai", "gemini", "ollama", "custom"
    AI_API_KEY: Optional[str] = None
    AI_MODEL: Optional[str] = None
    AI_API_BASE: Optional[str] = None

    # Security & CORS
    CORS_ORIGINS: List[str] = ["*"]

    @property
    def max_upload_bytes(self) -> int:
        return self.MAX_UPLOAD_MB * 1024 * 1024

    @property
    def storage_path(self) -> Path:
        if self.TEMP_DIR:
            p = Path(self.TEMP_DIR)
        else:
            p = Path(tempfile.gettempdir()) / "foldora_pdf_storage"
        p.mkdir(parents=True, exist_ok=True)
        return p


settings = Settings()
