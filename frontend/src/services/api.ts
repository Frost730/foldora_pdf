import { ToolDefinition, Job, PreviewResponse } from '../types';

const API_BASE = '/api';

export async function fetchTools(category?: string, query?: string): Promise<ToolDefinition[]> {
  const params = new URLSearchParams();
  if (category && category !== 'all') params.append('category', category);
  if (query) params.append('q', query);

  const res = await fetch(`${API_BASE}/tools?${params.toString()}`);
  if (!res.ok) throw new Error('Failed to fetch tools catalogue');
  return res.json();
}

export async function fetchTool(toolId: string): Promise<ToolDefinition> {
  const res = await fetch(`${API_BASE}/tools/${toolId}`);
  if (!res.ok) throw new Error(`Tool ${toolId} not found`);
  return res.json();
}

export async function createJob(
  toolId: string,
  files: File[],
  options: Record<string, any> = {}
): Promise<{ job_id: string; download_token: string; status: string }> {
  const formData = new FormData();
  formData.append('tool_id', toolId);
  formData.append('options', JSON.stringify(options));

  files.forEach((file) => {
    formData.append('files', file);
  });

  const res = await fetch(`${API_BASE}/jobs`, {
    method: 'POST',
    body: formData,
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({ detail: 'Upload and job creation failed' }));
    throw new Error(errorData.detail || 'Failed to create job');
  }

  return res.json();
}

export async function fetchJob(jobId: string): Promise<Job> {
  const res = await fetch(`${API_BASE}/jobs/${jobId}`);
  if (!res.ok) throw new Error('Job not found or has expired');
  return res.json();
}

export async function cancelJob(jobId: string): Promise<void> {
  await fetch(`${API_BASE}/jobs/${jobId}/cancel`, { method: 'POST' });
}

export async function deleteJob(jobId: string): Promise<void> {
  await fetch(`${API_BASE}/jobs/${jobId}`, { method: 'DELETE' });
}

export async function fetchPreview(
  file: File,
  pageIndex: number = 0,
  maxDim: number = 600
): Promise<PreviewResponse> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('page_index', pageIndex.toString());
  formData.append('max_dim', maxDim.toString());

  const res = await fetch(`${API_BASE}/previews`, {
    method: 'POST',
    body: formData,
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ detail: 'Failed to generate preview' }));
    throw new Error(error.detail || 'Preview generation error');
  }

  return res.json();
}

export async function pollJob(
  jobId: string,
  onUpdate: (job: Job) => void,
  intervalMs: number = 1000,
  maxAttempts: number = 180
): Promise<Job> {
  let attempts = 0;
  while (attempts < maxAttempts) {
    attempts++;
    const job = await fetchJob(jobId);
    onUpdate(job);

    if (job.status === 'completed' || job.status === 'failed' || job.status === 'cancelled' || job.status === 'expired') {
      return job;
    }

    await new Promise((r) => setTimeout(r, intervalMs));
  }
  throw new Error('Processing timed out. Please try again.');
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}
