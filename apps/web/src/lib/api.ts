// Thin fetch wrapper. Requests go to /api (proxied to the API server by Vite in dev).
export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

async function parse(res: Response): Promise<unknown> {
  const text = await res.text();
  const body = text ? JSON.parse(text) : null;
  if (!res.ok) {
    const err = (body as { error?: { code?: string; message?: string } } | null)?.error;
    throw new ApiError(res.status, err?.code ?? "ERROR", err?.message ?? res.statusText);
  }
  return body;
}

export async function apiGet<T>(path: string): Promise<T> {
  return parse(await fetch(path, { headers: { accept: "application/json" } })) as Promise<T>;
}

export async function apiPost<T>(path: string, body?: unknown): Promise<T> {
  return parse(
    await fetch(path, {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    }),
  ) as Promise<T>;
}

export async function apiPostForm<T>(path: string, form: FormData): Promise<T> {
  return parse(await fetch(path, { method: "POST", body: form })) as Promise<T>;
}
