const ACCESS_TOKEN_KEY = 'saas.accessToken';
const REFRESH_TOKEN_KEY = 'saas.refreshToken';
const TENANT_KEY = 'saas.tenant';

export type StoredTenant = {
  platformId: string;
  distributorId: string | null;
  clientId: string | null;
  userId: string;
  roles: string[];
  permissions: string[];
  isSupportSession: boolean;
};

export type LoginResponse = {
  accessToken: string;
  refreshToken: string;
  refreshTokenExpiresAt: string;
  mfaRequired: boolean;
  tenant: StoredTenant;
};

const isBrowser = (): boolean => typeof window !== 'undefined';

export const getAccessToken = (): string | null => {
  if (!isBrowser()) return null;
  return window.localStorage.getItem(ACCESS_TOKEN_KEY);
};

export const getTenant = (): StoredTenant | null => {
  if (!isBrowser()) return null;
  const raw = window.localStorage.getItem(TENANT_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as StoredTenant;
  } catch {
    return null;
  }
};

export const persistSession = (res: LoginResponse): void => {
  if (!isBrowser()) return;
  window.localStorage.setItem(ACCESS_TOKEN_KEY, res.accessToken);
  window.localStorage.setItem(REFRESH_TOKEN_KEY, res.refreshToken);
  window.localStorage.setItem(TENANT_KEY, JSON.stringify(res.tenant));
};

export const clearSession = (): void => {
  if (!isBrowser()) return;
  window.localStorage.removeItem(ACCESS_TOKEN_KEY);
  window.localStorage.removeItem(REFRESH_TOKEN_KEY);
  window.localStorage.removeItem(TENANT_KEY);
};

export type ApiError = { code: string; message: string };

const resolveApiBase = (): string => {
  if (!isBrowser()) return 'http://localhost:3001';
  const fromEnv = process.env.NEXT_PUBLIC_API_URL ?? process.env.NEXT_PUBLIC_API_BASE_URL;
  if (fromEnv && fromEnv.length > 0) return fromEnv;
  const origin = window.location.origin;
  if (origin.includes('localhost:3000') || origin.includes('127.0.0.1:3000')) {
    return 'http://localhost:3001';
  }
  return origin;
};

export const apiFetch = async <T>(
  path: string,
  init: RequestInit & { skipAuth?: boolean } = {},
): Promise<T> => {
  const headers = new Headers(init.headers ?? {});
  headers.set('Content-Type', 'application/json');
  if (!init.skipAuth) {
    const token = getAccessToken();
    if (token) headers.set('Authorization', `Bearer ${token}`);
  }
  const res = await fetch(`${resolveApiBase()}${path}`, { ...init, headers });
  if (!res.ok) {
    let body: ApiError = { code: 'UNKNOWN', message: res.statusText };
    try {
      body = (await res.json()) as ApiError;
    } catch {
      // ignore
    }
    const err = new Error(body.message) as Error & { code: string; status: number };
    err.code = body.code;
    err.status = res.status;
    throw err;
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
};

export type LoginInput = {
  platformId: string;
  email: string;
  password: string;
  mfaCode?: string;
};

export const login = (input: LoginInput): Promise<LoginResponse> =>
  apiFetch<LoginResponse>('/api/v1/auth/login', {
    method: 'POST',
    body: JSON.stringify(input),
    skipAuth: true,
  });
