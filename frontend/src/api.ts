export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export interface ApiResult<T = unknown> {
  ok: boolean;
  status: number;
  data: T;
}

async function request<T = unknown>(path: string, init: RequestInit = {}): Promise<ApiResult<T>> {
  const isJsonBody = typeof init.body === 'string';
  const res = await fetch(`${API_URL}${path}`, {
    credentials: 'include',
    ...init,
    headers: isJsonBody
      ? { 'Content-Type': 'application/json', ...(init.headers as Record<string, string> | undefined) }
      : init.headers,
  });

  let data: unknown;
  try {
    data = await res.json();
  } catch {
    data = null;
  }

  return { ok: res.ok, status: res.status, data: data as T };
}

export const apiGet = <T = unknown>(path: string) => request<T>(path);

export const apiPost = <T = unknown>(path: string, body?: unknown) =>
  request<T>(path, { method: 'POST', body: body !== undefined ? JSON.stringify(body) : undefined });

export const apiPut = <T = unknown>(path: string, body?: unknown) =>
  request<T>(path, { method: 'PUT', body: body !== undefined ? JSON.stringify(body) : undefined });

export const apiPatch = <T = unknown>(path: string, body?: unknown) =>
  request<T>(path, { method: 'PATCH', body: body !== undefined ? JSON.stringify(body) : undefined });

export const apiDelete = <T = unknown>(path: string) => request<T>(path, { method: 'DELETE' });

// Multipart uploads (CSV/PDF import) — no Content-Type header, so the browser
// sets the multipart boundary itself.
export const apiUpload = <T = unknown>(path: string, formData: FormData) =>
  request<T>(path, { method: 'POST', body: formData });

/** Reads FastAPI's `{ detail: string }` error shape without an `any` cast. */
export function apiErrorDetail(data: unknown, fallback: string): string {
  if (data && typeof data === 'object' && 'detail' in data && typeof (data as { detail?: unknown }).detail === 'string') {
    return (data as { detail: string }).detail;
  }
  return fallback;
}
