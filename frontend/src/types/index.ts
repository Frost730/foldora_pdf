export type ToolCategory =
  | 'organize'
  | 'optimize'
  | 'convert_to'
  | 'convert_from'
  | 'edit'
  | 'sign'
  | 'security'
  | 'ai_advanced';

export interface ToolDefinition {
  id: string;
  name: string;
  tagline: string;
  description: string;
  category: ToolCategory;
  icon: string;
  accepts: string[];
  max_files: number;
  popular?: boolean;
  requires_ai_key?: boolean;
}

export type JobStatus =
  | 'queued'
  | 'processing'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'expired';

export interface OutputFile {
  file_id: string;
  filename: string;
  size_bytes: number;
  content_type: string;
  download_url: string;
}

export interface InputFileInfo {
  file_id: string;
  original_name: string;
  size_bytes: number;
  content_type: string;
  page_count?: number;
}

export interface Job {
  id: string;
  tool_id: string;
  status: JobStatus;
  progress: number;
  message: string;
  error?: string;
  created_at: string;
  updated_at: string;
  expires_at?: string;
  download_token: string;
  input_files: InputFileInfo[];
  output_files: OutputFile[];
  metadata: Record<string, any>;
  options: Record<string, any>;
}

export interface UploadedFileItem {
  id: string;
  file: File;
  previewUrl?: string;
  pageCount?: number;
  rotation?: number;
}

export interface PreviewResponse {
  total_pages: number;
  current_page: number;
  image_base64: string;
  width: number;
  height: number;
  text_content?: string;
}
