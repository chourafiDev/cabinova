// Fetch wrapper for the NestJS API, called from the browser through the
// /api proxy (next.config.ts). The session cookie is sent automatically.

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string | undefined,
    message: string,
  ) {
    super(message);
  }
}

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`/api${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...init.headers },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new ApiError(res.status, body?.code, body?.message ?? res.statusText);
  }
  return res.status === 204 ? (undefined as T) : res.json();
}
