/**
 * HTTP core for the console.
 *
 * The backend mounts its REST surface under `/api/v1`, so that is the default
 * base and every module in this folder builds paths relative to it. The base is
 * overridable with VITE_API_BASE_URL for deployments where the console and the
 * API are served from different origins.
 *
 * Nothing here invents data. A failed request throws an `ApiError` carrying the
 * real status and the backend's own message, and every caller is expected to
 * render that failure rather than substituting a placeholder.
 */

/** Versioned REST base, e.g. `/api/v1`. */
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "/api/v1";

/**
 * Unversioned root, used for the two endpoints the backend serves outside the
 * version prefix: `/health` and `/ready`. Same origin in dev so they go through
 * the Vite proxy too.
 */
export const API_ROOT_URL = API_BASE_URL.replace(/\/api\/v1\/?$/, "");

/** One field-level problem out of a FastAPI 422 payload. */
export interface FieldIssue {
  field: string;
  message: string;
}

/**
 * A failed API call.
 *
 * `message` is always a readable single string. FastAPI returns 422 as
 * `detail: [{loc, msg, type}, ...]`, which stringifies to something like
 * "[object Object],[object Object]" if handed to `new Error()` directly — the
 * shape is flattened here instead, and kept in `fields` for per-input display.
 */
export class ApiError extends Error {
  readonly status: number;
  readonly fields: FieldIssue[];

  constructor(status: number, message: string, fields: FieldIssue[] = []) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.fields = fields;
  }

  /** The token is missing, expired or rejected. */
  get isUnauthorized(): boolean {
    return this.status === 401;
  }

  /** Authenticated, but this role may not perform the action. */
  get isForbidden(): boolean {
    return this.status === 403;
  }

  /** The case, alert or prediction being asked for does not exist. */
  get isNotFound(): boolean {
    return this.status === 404;
  }
}

type UnauthorizedHandler = () => void;

let onUnauthorized: UnauthorizedHandler | null = null;

/**
 * Registered once by the auth module. Fired when a request that *carried* a
 * token is rejected with 401, so an expired session ends in a clean redirect
 * instead of a console full of failed fetches. Requests that opt out — the
 * login call itself — never trigger it.
 */
export function setUnauthorizedHandler(handler: UnauthorizedHandler | null): void {
  onUnauthorized = handler;
}

function flattenDetail(detail: unknown): { message: string; fields: FieldIssue[] } {
  if (typeof detail === "string") {
    return { message: detail, fields: [] };
  }

  if (Array.isArray(detail)) {
    const fields: FieldIssue[] = [];
    for (const entry of detail) {
      if (!entry || typeof entry !== "object") continue;
      const { loc, msg } = entry as { loc?: unknown; msg?: unknown };
      const path = Array.isArray(loc) ? loc.filter((p) => p !== "body").join(".") : "";
      const message = typeof msg === "string" ? msg : "Invalid value";
      fields.push({ field: path, message });
    }
    if (fields.length === 0) {
      return { message: "Request rejected by the server.", fields: [] };
    }
    const summary = fields
      .map((f) => (f.field ? `${f.field}: ${f.message}` : f.message))
      .join(" · ");
    return { message: summary, fields };
  }

  if (detail && typeof detail === "object") {
    // The backend's own error envelope: {"error": {"code", "message"}}.
    const envelope = (detail as { error?: { message?: unknown } }).error;
    if (envelope && typeof envelope.message === "string") {
      return { message: envelope.message, fields: [] };
    }
  }

  return { message: "", fields: [] };
}

async function readError(response: Response): Promise<ApiError> {
  const fallback: Record<number, string> = {
    401: "Session expired. Sign in again.",
    403: "Your role is not permitted to perform this action.",
    404: "Not found.",
    409: "That request conflicts with the current state.",
    422: "The request was rejected as invalid.",
  };

  let message = "";
  let fields: FieldIssue[] = [];

  try {
    const body = (await response.json()) as { detail?: unknown };
    const flattened = flattenDetail(body?.detail);
    message = flattened.message;
    fields = flattened.fields;
  } catch {
    // A proxy or a crashed handler can return HTML or nothing at all.
  }

  if (!message) {
    message = fallback[response.status] || response.statusText || `Request failed (${response.status})`;
  }

  return new ApiError(response.status, message, fields);
}

async function readBody<T>(response: Response): Promise<T> {
  if (response.status === 204) return {} as T;
  // A 200 with an empty body is still a successful call; the caller decides
  // what an absent payload means rather than having JSON parsing throw here.
  const text = await response.text();
  if (!text) return {} as T;
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new ApiError(response.status, "The server returned a response that could not be read.");
  }
}

interface RequestOptions {
  /**
   * Set for endpoints whose own 401 is the expected answer rather than an
   * expired session — the login form, mainly.
   */
  skipUnauthorizedHandler?: boolean;
}

async function request<T>(
  endpoint: string,
  init: RequestInit = {},
  options: RequestOptions = {},
): Promise<T> {
  const token = localStorage.getItem("purva.session");
  const headers = new Headers(init.headers);

  // Only body-carrying requests get a JSON content type; advertising it on a
  // GET makes some proxies reject the request.
  if (init.body !== undefined && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  let session: { token?: string } | null = null;
  if (token) {
    try {
      session = JSON.parse(token) as { token?: string };
    } catch {
      session = null;
    }
  }
  if (session?.token) {
    headers.set("Authorization", `Bearer ${session.token}`);
  }

  const response = await fetch(`${API_BASE_URL}${endpoint}`, { ...init, headers });

  if (response.status === 401 && !options.skipUnauthorizedHandler) {
    onUnauthorized?.();
  }

  if (!response.ok) {
    throw await readError(response);
  }

  return readBody<T>(response);
}

export const api = {
  get: <T>(endpoint: string, options?: RequestOptions) =>
    request<T>(endpoint, { method: "GET" }, options),

  post: <T>(endpoint: string, body?: unknown, options?: RequestOptions) =>
    request<T>(
      endpoint,
      {
        method: "POST",
        // FastAPI models with all-default fields still require a body object;
        // an empty JSON object is the correct "use the defaults" call.
        body: JSON.stringify(body ?? {}),
      },
      options,
    ),

  put: <T>(endpoint: string, body?: unknown) =>
    request<T>(endpoint, { method: "PUT", body: JSON.stringify(body ?? {}) }),

  delete: <T>(endpoint: string) => request<T>(endpoint, { method: "DELETE" }),
};

/** Builds a query string, skipping empty and zero values. */
export function query(params: Record<string, string | number | undefined | null>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") continue;
    if (typeof value === "number" && Number.isNaN(value)) continue;
    search.set(key, String(value));
  }
  const qs = search.toString();
  return qs ? `?${qs}` : "";
}
