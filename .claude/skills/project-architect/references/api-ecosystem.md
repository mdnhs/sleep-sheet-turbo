# API Ecosystem

Optional feature. Generate these files only when the user selects the API Ecosystem option.

Includes:

- A unified REST API client (`src/lib/api-client/index.ts`) with auth header injection, timeout, IP forwarding, and standardised response parsing
- A debug logger (`src/lib/api-client/debug.ts`) that logs requests/responses/errors in development

## Which backend is this talking to?

- **Internal Hono API (default in this architecture)** — the API is same-origin. Leave
  `NEXT_PUBLIC_API_BASE_URL` empty in production; the client falls back to `NEXT_PUBLIC_APP_URL`
  for server-side calls (an absolute URL is required there) and relative paths in the browser, which
  avoids a DNS lookup and a CORS preflight. Responses use the Hono envelope
  `{ success, data, pagination?, error? }` — see **Internal envelope** below. No case conversion is
  needed: Drizzle already returns `camelCase`.
- **External backend** — set `NEXT_PUBLIC_API_BASE_URL` and keep the legacy
  `{ data, error, message }` envelope and the snake↔camel mapping below.

Server Components must **not** use this client to call this project's own `/api` routes. Import the
server service directly (`@/server/services/...`); a self-fetch costs a second function invocation
and a full network round trip.

Case conversion (snake↔camel) is **not** handled by the API client. It is done explicitly at the feature service layer using `mapCamelToSnake` / `mapSnakeToCamel` from `@/lib/utils`. See the case-conversion reference for the pattern.

---

## `src/lib/api-client/index.ts`

```typescript
/**
 * Unified API Client for handling all HTTP requests.
 * Automatically detects server/client environment.
 * Provides standardized error handling, authentication, and request formatting.
 */
import { isDebugEnabled, logError, logRequest, logResponse } from '@/lib/api-client/debug';

// TODO: adjust to match your backend's actual pagination response shape
export interface PaginationApiResponse {
  total: number;
  total_pages: number;
  current_page: number;
  limit: number;
  has_next_page: boolean;
  has_prev_page: boolean;
}

export interface BackendApiResponse<T> {
  data: T | null;
  pagination?: PaginationApiResponse;
  error: boolean;
  message: string;
}

export type NetworkError = {
  message?: string;
  code?: string;
  details?: unknown;
};

export interface ValidationError {
  type: string;
}

export interface ValidationCauses {
  [fieldName: string]: ValidationError[];
}

export type ApiResponse<T> = {
  data: {
    data: T | null;
    pagination?: PaginationApiResponse;
    error: boolean;
    message: string;
    causes?: ValidationCauses;
  } | null;
  error: NetworkError | null;
  status: number;
};

export interface ApiClientConfig {
  baseUrl?: string;
  apiPrefix?: string;
  apiVersion?: string;
  timeout?: number;
  defaultHeaders?: Record<string, string>;
}

const DEFAULT_CONFIG = {
  // Empty NEXT_PUBLIC_API_BASE_URL = same-origin internal Hono API.
  BASE_URL:
    process.env.NEXT_PUBLIC_API_BASE_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    (typeof window === 'undefined' ? 'http://localhost:3000' : ''),
  API_PREFIX: process.env.NEXT_PUBLIC_API_PREFIX || '/api',
  API_VERSION: process.env.NEXT_PUBLIC_API_VERSION || '/v1',
  TIMEOUT: Number(process.env.NEXT_PUBLIC_API_TIMEOUT || 30000),
  DEFAULT_HEADERS: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
};

const API_CONFIG = { ...DEFAULT_CONFIG };

const isServerSide = (): boolean => typeof window === 'undefined';

const getClientIP = async (): Promise<string | null> => {
  if (process.env.NODE_ENV === 'development' && process.env.MOCK_CLIENT_IP) {
    return process.env.MOCK_CLIENT_IP;
  }
  if (!isServerSide()) return null;
  try {
    const { headers } = await import('next/headers');
    const headersList = await headers();
    const middlewareIP = headersList.get('x-client-ip');
    if (middlewareIP) return middlewareIP;
    const forwardedFor = headersList.get('x-forwarded-for');
    const realIP = headersList.get('x-real-ip');
    const cfConnectingIP = headersList.get('cf-connecting-ip');
    const vercelIP = headersList.get('x-vercel-forwarded-for');
    if (forwardedFor) return forwardedFor.split(',')[0].trim();
    return cfConnectingIP || vercelIP || realIP || null;
  } catch (error) {
    console.error('Failed to get client IP:', error);
    return null;
  }
};

const getAuthToken = async (): Promise<string | null> => {
  // TODO: implement — replace with your auth method (NextAuth, Clerk, custom JWT, etc.)
  return null;
};

const getCurrentSession = async () => {
  // TODO: implement session retrieval
  return null;
};

export const isAuthenticated = async (): Promise<boolean> => {
  // TODO: implement — returns true as placeholder until auth is set up
  return true;
};

export const configureApiClient = (config: ApiClientConfig): void => {
  if (config.baseUrl) API_CONFIG.BASE_URL = config.baseUrl;
  if (config.apiPrefix) API_CONFIG.API_PREFIX = config.apiPrefix;
  if (config.apiVersion) API_CONFIG.API_VERSION = config.apiVersion;
  if (config.timeout) API_CONFIG.TIMEOUT = config.timeout;
  if (config.defaultHeaders) {
    API_CONFIG.DEFAULT_HEADERS = { ...API_CONFIG.DEFAULT_HEADERS, ...config.defaultHeaders };
  }
};

export const getApiBaseUrl = (): string => `${API_CONFIG.BASE_URL}${API_CONFIG.API_PREFIX}${API_CONFIG.API_VERSION}`;

export const getApiConfig = () => ({
  baseUrl: API_CONFIG.BASE_URL,
  apiPrefix: API_CONFIG.API_PREFIX,
  apiVersion: API_CONFIG.API_VERSION,
  timeout: API_CONFIG.TIMEOUT,
  fullApiUrl: getApiBaseUrl(),
  environment: isServerSide() ? 'server' : 'client',
});

const createTimeoutPromise = (ms: number): Promise<never> =>
  new Promise((_, reject) => setTimeout(() => reject(new Error(`Request timed out after ${ms}ms`)), ms));

const createHeaders = async (customHeaders?: HeadersInit): Promise<Headers> => {
  const headers = new Headers(API_CONFIG.DEFAULT_HEADERS);
  const token = await getAuthToken();
  if (token) headers.append('Authorization', `Bearer ${token}`);
  if (isServerSide()) {
    const clientIP = await getClientIP();
    if (clientIP) {
      headers.append('X-Client-IP', clientIP);
      headers.append('X-Forwarded-For', clientIP);
    }
  }
  if (customHeaders) {
    Object.entries(customHeaders).forEach(([key, value]) => {
      if (value !== undefined && value !== null) headers.set(key, String(value));
    });
  }
  return headers;
};

const formatNetworkErrorResponse = <T>(error: unknown, status = 500): ApiResponse<T> => {
  let message = 'Network error occurred';
  let details: unknown = undefined;
  if (error instanceof Error) {
    message = error.message;
    details = error.stack;
  } else if (typeof error === 'string') {
    message = error;
  } else if (error && typeof error === 'object') {
    message = String(error);
    details = error;
  }
  return { data: null, error: { message, details }, status };
};

const parseResponse = async <T>(response: Response): Promise<ApiResponse<T>> => {
  const status = response.status;

  if (status === 401) {
    // TODO: implement 401 handling — sign out user and redirect to login
    // Example (NextAuth): await signOut(); redirect('/login');
  }

  if (status === 503) {
    if (!isServerSide()) {
      window.location.href = '/maintenance';
    } else {
      const { redirect } = await import('next/navigation');
      redirect('/maintenance');
    }
  }

  if (response.ok) {
    try {
      const text = await response.text();
      const data = text ? (JSON.parse(text) as BackendApiResponse<T>) : null;
      return { data, error: null, status };
    } catch {
      return formatNetworkErrorResponse(new Error('Failed to parse successful response'), status);
    }
  }

  try {
    const text = await response.text();
    const data = text ? (JSON.parse(text) as BackendApiResponse<T>) : null;
    return { data, error: null, status };
  } catch {
    return formatNetworkErrorResponse(
      new Error(`Request failed with status ${status} - Invalid response format`),
      status,
    );
  }
};

const buildFullUrl = (url: string): string => {
  if (url.startsWith('http')) return url;
  if (url.startsWith(`${API_CONFIG.API_PREFIX}${API_CONFIG.API_VERSION}`)) return `${API_CONFIG.BASE_URL}${url}`;
  if (url.startsWith(API_CONFIG.API_PREFIX))
    return `${API_CONFIG.BASE_URL}${API_CONFIG.API_PREFIX}${API_CONFIG.API_VERSION}${url.replace(API_CONFIG.API_PREFIX, '')}`;
  const cleanUrl = url.startsWith('/') ? url : `/${url}`;
  return `${getApiBaseUrl()}${cleanUrl}`;
};

export const apiRequest = async <T>(url: string, options: RequestInit = {}): Promise<ApiResponse<T>> => {
  const startTime = Date.now();
  try {
    const fullUrl = buildFullUrl(url);
    const requestOptions: RequestInit = {
      ...options,
      headers: await createHeaders(options.headers),
    };
    if (isDebugEnabled()) logRequest(url, fullUrl, requestOptions);
    const response = (await Promise.race([
      fetch(fullUrl, requestOptions),
      createTimeoutPromise(API_CONFIG.TIMEOUT),
    ])) as Response;
    if (isDebugEnabled()) await logResponse(response, startTime);
    return await parseResponse<T>(response);
  } catch (error) {
    if (isDebugEnabled()) logError(error, url, startTime);
    if (error && typeof error === 'object' && 'digest' in error) {
      const digest = (error as { digest?: string }).digest;
      if (typeof digest === 'string' && digest.startsWith('NEXT_REDIRECT')) throw error;
    }
    return formatNetworkErrorResponse<T>(error);
  }
};

export const get = async <T>(
  url: string,
  params?: Record<string, string | string[]>,
  headers?: HeadersInit,
): Promise<ApiResponse<T>> => {
  let requestUrl = url;
  if (params) {
    const queryString = Object.entries(params)
      .map(([key, value]) =>
        Array.isArray(value)
          ? value.map((item) => `${encodeURIComponent(key)}=${encodeURIComponent(String(item))}`).join('&')
          : `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`,
      )
      .join('&');
    if (queryString) requestUrl += `${url.includes('?') ? '&' : '?'}${queryString}`;
  }
  return apiRequest<T>(requestUrl, { method: 'GET', headers });
};

export const post = async <T>(url: string, data?: unknown, headers?: HeadersInit): Promise<ApiResponse<T>> =>
  apiRequest<T>(url, { method: 'POST', headers, body: data ? JSON.stringify(data) : undefined });

export const put = async <T>(url: string, data?: unknown, headers?: HeadersInit): Promise<ApiResponse<T>> =>
  apiRequest<T>(url, { method: 'PUT', headers, body: data ? JSON.stringify(data) : undefined });

export const patch = async <T>(url: string, data?: unknown, headers?: HeadersInit): Promise<ApiResponse<T>> =>
  apiRequest<T>(url, { method: 'PATCH', headers, body: data ? JSON.stringify(data) : undefined });

export const del = async <T>(url: string, headers?: HeadersInit): Promise<ApiResponse<T>> =>
  apiRequest<T>(url, { method: 'DELETE', headers });

export const isBackendSuccess = <T>(response: ApiResponse<T>): boolean =>
  response.error === null && response.data !== null && !response.data.error && response.status < 400;

export const extractBackendData = <T>(response: ApiResponse<T>): T | null =>
  isBackendSuccess(response) ? response.data!.data : null;

export const extractValidationCauses = <T>(response: ApiResponse<T>): ValidationCauses | null =>
  !isBackendSuccess(response) ? (response.data?.causes ?? null) : null;

export const extractPagination = <T>(response: ApiResponse<T>): PaginationApiResponse | null =>
  response.data?.pagination ?? null;

export const getBackendErrorMessage = <T>(response: ApiResponse<T>): string | null =>
  response.data?.error ? response.data.message : null;

export const getMessage = <T>(response: ApiResponse<T>): string => {
  if (response.error) return response.error.message || 'Network error occurred';
  if (response.data?.error) return response.data.message;
  if (response.status >= 400) return response.data?.message || `Request failed with status ${response.status}`;
  if (response.data && !response.data.error) return response.data.message;
  return 'Unknown error occurred';
};

export const hasError = <T>(response: ApiResponse<T>): boolean => !isBackendSuccess(response);

export const getStatusCode = <T>(response: ApiResponse<T>): number => response.status;

export const restApiClient = {
  get,
  post,
  put,
  patch,
  delete: del,
  request: apiRequest,
  configure: configureApiClient,
  getConfig: getApiConfig,
  getBaseUrl: getApiBaseUrl,
  isAuthenticated,
  getCurrentSession,
  isBackendSuccess,
  extractBackendData,
  extractPagination,
  getBackendErrorMessage,
  getMessage,
  hasError,
  getStatusCode,
};

export default restApiClient;
```

---

## `src/lib/api-client/debug.ts`

```typescript
/**
 * Comprehensive debugging system for SSR API requests.
 * Enabled when NODE_ENV=development or NEXT_PUBLIC_DEBUG_API=true.
 */

interface DebugRequestInfo {
  timestamp: string;
  environment: 'server' | 'client';
  url: string;
  fullUrl: string;
  method: string;
  headers: Record<string, string>;
  body?: string | object;
  queryParams?: Record<string, string | string[]>;
}

interface DebugResponseInfo {
  timestamp: string;
  status: number;
  statusText: string;
  headers: Record<string, string>;
  body?: unknown;
  duration: number;
}

const formatHeaders = (headers: Headers): Record<string, string> => {
  const headerObj: Record<string, string> = {};
  headers.forEach((value, key) => {
    headerObj[key] = value;
  });
  return headerObj;
};

const extractQueryParams = (url: string): Record<string, string | string[]> | undefined => {
  try {
    const urlObj = new URL(url);
    const params: Record<string, string | string[]> = {};
    urlObj.searchParams.forEach((value, key) => {
      if (params[key]) {
        if (Array.isArray(params[key])) {
          (params[key] as string[]).push(value);
        } else {
          params[key] = [params[key] as string, value];
        }
      } else {
        params[key] = value;
      }
    });
    return Object.keys(params).length > 0 ? params : undefined;
  } catch {
    return undefined;
  }
};

const parseRequestBody = (body?: BodyInit | null): string | object | undefined => {
  if (!body) return undefined;
  if (typeof body === 'string') {
    try {
      return JSON.parse(body);
    } catch {
      return body;
    }
  }
  return '[Binary/FormData/Complex Body]';
};

export const logRequest = (url: string, fullUrl: string, options: RequestInit): DebugRequestInfo => {
  const debugInfo: DebugRequestInfo = {
    timestamp: new Date().toISOString(),
    environment: typeof window === 'undefined' ? 'server' : 'client',
    url,
    fullUrl,
    method: options.method || 'GET',
    headers: options.headers ? formatHeaders(options.headers as Headers) : {},
    body: parseRequestBody(options.body),
    queryParams: extractQueryParams(fullUrl),
  };

  console.log('\n╔══════════════════════════════════════════════════════════════╗');
  console.log('║                    API REQUEST DEBUG                         ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');
  console.log(`🕐 Timestamp:    ${debugInfo.timestamp}`);
  console.log(`🌍 Environment:  ${debugInfo.environment.toUpperCase()}`);
  console.log(`📍 Method:       ${debugInfo.method}`);
  console.log(`🔗 Original URL: ${debugInfo.url}`);
  console.log(`🔗 Full URL:     ${debugInfo.fullUrl}`);
  if (debugInfo.queryParams) {
    console.log('\n📋 Query Parameters:');
    console.log(JSON.stringify(debugInfo.queryParams, null, 2));
  }
  console.log('\n📨 Request Headers:');
  console.log(JSON.stringify(debugInfo.headers, null, 2));
  if (debugInfo.body) {
    console.log('\n📦 Request Body:');
    console.log(typeof debugInfo.body === 'object' ? JSON.stringify(debugInfo.body, null, 2) : debugInfo.body);
  }
  console.log('─────────────────────────────────────────────────────────────\n');

  return debugInfo;
};

export const logResponse = async (response: Response, startTime: number): Promise<DebugResponseInfo> => {
  const duration = Date.now() - startTime;
  const clonedResponse = response.clone();
  let responseBody: unknown;
  try {
    const text = await clonedResponse.text();
    responseBody = text ? JSON.parse(text) : null;
  } catch {
    responseBody = '[Could not parse response body]';
  }

  const debugInfo: DebugResponseInfo = {
    timestamp: new Date().toISOString(),
    status: response.status,
    statusText: response.statusText,
    headers: formatHeaders(response.headers),
    body: responseBody,
    duration,
  };

  const statusEmoji = response.ok ? '✅' : '❌';
  const statusColor = response.ok ? '' : '🔴 ';

  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║                   API RESPONSE DEBUG                         ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');
  console.log(`🕐 Timestamp:    ${debugInfo.timestamp}`);
  console.log(`${statusEmoji} Status:       ${statusColor}${debugInfo.status} ${debugInfo.statusText}`);
  console.log(`⏱️  Duration:     ${debugInfo.duration}ms`);
  console.log('\n📬 Response Headers:');
  console.log(JSON.stringify(debugInfo.headers, null, 2));
  if (debugInfo.body) {
    console.log('\n📦 Response Body:');
    console.log(typeof debugInfo.body === 'object' ? JSON.stringify(debugInfo.body, null, 2) : debugInfo.body);
  }
  console.log('═════════════════════════════════════════════════════════════\n\n');

  return debugInfo;
};

export const logError = (error: unknown, url: string, startTime: number): void => {
  const duration = Date.now() - startTime;

  console.log('\n╔══════════════════════════════════════════════════════════════╗');
  console.log('║                     API ERROR DEBUG                          ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');
  console.log(`🕐 Timestamp:    ${new Date().toISOString()}`);
  console.log(`❌ Error:        ${error instanceof Error ? error.message : String(error)}`);
  console.log(`🔗 URL:          ${url}`);
  console.log(`⏱️  Duration:     ${duration}ms`);
  if (error instanceof Error && error.stack) {
    console.log('\n📚 Stack Trace:');
    console.log(error.stack);
  }
  console.log('═════════════════════════════════════════════════════════════\n\n');
};

// Keep this false in production: logging every request/response body inflates the
// Vercel log/observability meter and lengthens each billed invocation.
export const isDebugEnabled = (): boolean =>
  process.env.NODE_ENV === 'development' || process.env.NEXT_PUBLIC_DEBUG_API === 'true';
```

---

## Internal envelope (Hono API)

When the backend is the Hono API in this project, the client parses this shape instead of the
legacy one. Keep it in sync with `src/server/lib/response.ts` — see `hono-api.md`.

```typescript
export interface PaginationMeta {
  total: number;
  totalPages: number;
  currentPage: number;
  limit: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

export type ApiEnvelope<T> =
  | { success: true; data: T; pagination?: PaginationMeta }
  | { success: false; error: { code: string; message: string; causes?: Record<string, string[]> } };

export const isSuccess = <T>(body: ApiEnvelope<T> | null): body is Extract<ApiEnvelope<T>, { success: true }> =>
  body?.success === true;
```

Feature services unwrap this into `ServiceResponse<T>` — see the new-feature skill.

Full type safety without hand-written generics is available via Hono RPC:

```typescript
import { hc } from 'hono/client';
import type { ApiType } from '@/server/api';

export const rpc = hc<ApiType>(process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000');
```

Pick REST-client **or** RPC per project and stay consistent.

## Setup commands to append

```bash
# No extra setup needed for the REST client.
# Hono RPC client (optional, comes with hono):
# pnpm add hono
```
