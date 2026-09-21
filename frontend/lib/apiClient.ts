import type { ApiErrorBody } from "@/lib/types";

export class ApiError extends Error {
  errorCode: string;
  status: number;
  details?: Record<string, unknown>;

  constructor(status: number, body: ApiErrorBody) {
    super(body.message);
    this.status = status;
    this.errorCode = body.error_code;
    this.details = body.details;
  }
}

// JWT期限切れ/不正時のハンドラ(要件3.1節・決定事項No.28、FE-013)。
// AuthProviderが購入リスト等のstateを破棄しログイン画面へ遷移させるために登録する。
let authExpiredHandler: (() => void) | null = null;

export function setAuthExpiredHandler(handler: (() => void) | null): void {
  authExpiredHandler = handler;
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const response = await fetch(path, {
    method,
    headers: body !== undefined ? { "Content-Type": "application/json" } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (response.status === 204) {
    return undefined as T;
  }

  const text = await response.text();
  const data = text ? JSON.parse(text) : undefined;

  if (!response.ok) {
    const errorBody = data as ApiErrorBody;
    if (response.status === 401 && errorBody?.error_code === "AUTH_TOKEN_EXPIRED") {
      authExpiredHandler?.();
    }
    throw new ApiError(response.status, errorBody);
  }

  return data as T;
}

export const apiClient = {
  get: <T>(path: string) => request<T>("GET", path),
  post: <T>(path: string, body?: unknown) => request<T>("POST", path, body),
  put: <T>(path: string, body?: unknown) => request<T>("PUT", path, body),
  delete: <T>(path: string) => request<T>("DELETE", path),
};
