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

export interface TextSpan {
  text: string;
  bbox: [number, number, number, number]; // [x0, y0, x1, y1] in PDF points
  size: number;
  font: string;
  color: string;
}

export interface PreviewResponse {
  total_pages: number;
  current_page: number;
  image_base64: string;
  width: number;
  height: number;
  text_content?: string;
  page_width_pt?: number;
  page_height_pt?: number;
  text_spans?: TextSpan[];
}

export type VisualEditType =
  | 'replace_text'
  | 'add_text'
  | 'image'
  | 'drawing'
  | 'shape'
  | 'whiteout'
  | 'highlight'
  | 'line'
  | 'stamp'
  | 'form_text'
  | 'form_checkbox'
  | 'form_signature';

export interface VisualEditItem {
  id: string;
  type: VisualEditType;
  page: number;
  find_text?: string;
  replace_text?: string;
  bbox?: [number, number, number, number];
  text?: string;
  x?: number;
  y?: number;
  w?: number;
  h?: number;
  x1?: number;
  y1?: number;
  x2?: number;
  y2?: number;
  is_arrow?: boolean;
  is_bold?: boolean;
  is_italic?: boolean;
  size?: number;
  color?: string;
  bg_color?: string;
  font_family?: string;
  image_base64?: string;
  points?: [number, number][];
  stroke_width?: number;
  stroke_color?: string;
  shape_type?: 'rect' | 'circle';
  fill_color?: string;
  name?: string;
  value?: string;
  checked?: boolean;
  placeholder?: string;
  is_required?: boolean;
}

