// Thin fetch wrapper. All calls go to the same origin (/api is proxied to the backend by Next.js).

export interface FieldError { field: string; message: string }

export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string, public fieldErrors: FieldError[] = []) {
    super(message);
  }
}

const TOKEN_KEY = "tabletap.token";

export const tokenStore = {
  get(): string | null {
    try { return window.localStorage.getItem(TOKEN_KEY); } catch { return null; }
  },
  set(token: string) {
    try { window.localStorage.setItem(TOKEN_KEY, token); } catch { /* private mode */ }
  },
  clear() {
    try { window.localStorage.removeItem(TOKEN_KEY); } catch { /* ignore */ }
  },
};

type Query = Record<string, string | number | boolean | null | undefined>;

interface RequestOptions {
  method?: string;
  body?: unknown;
  query?: Query;
  auth?: boolean;
  signal?: AbortSignal;
}

let onUnauthorized: (() => void) | null = null;
export function setUnauthorizedHandler(fn: (() => void) | null) { onUnauthorized = fn; }

export async function api<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const { method = "GET", body, query, auth = true, signal } = opts;
  const url = new URL(path.startsWith("/api") ? path : `/api/v1${path}`, window.location.origin);
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v !== undefined && v !== null && v !== "") url.searchParams.set(k, String(v));
    }
  }
  const headers: Record<string, string> = { Accept: "application/json" };
  const isForm = typeof FormData !== "undefined" && body instanceof FormData;
  if (body !== undefined && !isForm) headers["Content-Type"] = "application/json";
  if (auth) {
    const token = tokenStore.get();
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  let res: Response;
  try {
    res = await fetch(url, {
      method, headers, signal,
      body: body === undefined ? undefined : isForm ? (body as FormData) : JSON.stringify(body),
    });
  } catch (e) {
    if ((e as Error).name === "AbortError") throw e;
    throw new ApiError(0, "NETWORK_ERROR", "Can't reach the server. Check your connection and try again.");
  }

  if (res.status === 204) return undefined as T;
  const text = await res.text();
  const data = text ? safeJson(text) : null;
  if (!res.ok) {
    if (res.status === 401 && auth && onUnauthorized) onUnauthorized();
    const err = (data ?? {}) as { code?: string; message?: string; fieldErrors?: FieldError[] };
    throw new ApiError(res.status, err.code ?? "ERROR",
      err.message ?? (res.status >= 500 ? "Something went wrong. Please try again." : "Request failed"),
      err.fieldErrors ?? []);
  }
  return data as T;
}

function safeJson(text: string) {
  try { return JSON.parse(text); } catch { return null; }
}

export function errorMessage(e: unknown, fallback = "Something went wrong") {
  if (e instanceof ApiError) {
    if (e.fieldErrors.length) return `${e.message}: ${e.fieldErrors.map((f) => `${f.field} ${f.message}`).join(", ")}`;
    return e.message;
  }
  return fallback;
}
