from enum import Enum
from typing import Dict, List, Optional, Any
from datetime import datetime, timezone
from pydantic import BaseModel, Field


class JobStatus(str, Enum):
    QUEUED = "queued"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"
    EXPIRED = "expired"


class ToolCategory(str, Enum):
    ORGANIZE = "organize"
    OPTIMIZE = "optimize"
    CONVERT_TO = "convert_to"
    CONVERT_FROM = "convert_from"
    EDIT = "edit"
    SIGN = "sign"
    SECURITY = "security"
    AI_ADVANCED = "ai_advanced"


class FileInfo(BaseModel):
    file_id: str
    original_name: str
    size_bytes: int
    content_type: str
    page_count: Optional[int] = None
    width: Optional[float] = None
    height: Optional[float] = None


class OutputFile(BaseModel):
    file_id: str
    filename: str
    size_bytes: int
    content_type: str
    download_url: str


class Job(BaseModel):
    id: str
    tool_id: str
    status: JobStatus = JobStatus.QUEUED
    progress: int = 0
    message: str = "Job queued"
    error: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    expires_at: Optional[datetime] = None
    download_token: str
    input_files: List[FileInfo] = Field(default_factory=list)
    output_files: List[OutputFile] = Field(default_factory=list)
    metadata: Dict[str, Any] = Field(default_factory=dict)
    options: Dict[str, Any] = Field(default_factory=dict)


class ToolDefinition(BaseModel):
    id: str
    name: str
    tagline: str
    description: str
    category: ToolCategory
    icon: str
    accepts: List[str]
    max_files: int = 10
    popular: bool = False
    requires_ai_key: bool = False
    options_schema: Optional[Dict[str, Any]] = None


class PreviewRequest(BaseModel):
    page_index: int = 0
    max_dim: int = 800


class PreviewResponse(BaseModel):
    total_pages: int
    current_page: int
    image_base64: str
    width: int
    height: int
    text_content: Optional[str] = None
