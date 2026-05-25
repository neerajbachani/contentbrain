type ApiMethod = "GET" | "POST" | "PATCH" | "PUT" | "DELETE";

const API_DEBUG_ENABLED = process.env.EXPO_PUBLIC_API_DEBUG === "true";
const SHOULD_LOG_VERBOSE = typeof __DEV__ !== "undefined" ? __DEV__ || API_DEBUG_ENABLED : API_DEBUG_ENABLED;

type ApiErrorBody = {
  error?: string;
  message?: string;
  code?: number;
  requestId?: string;
  path?: string;
  method?: string;
};

export class ApiResponseError extends Error {
  status: number;
  method: ApiMethod;
  path: string;
  requestId?: string;
  body?: unknown;

  constructor(args: {
    status: number;
    method: ApiMethod;
    path: string;
    message: string;
    requestId?: string;
    body?: unknown;
  }) {
    super(args.message);
    this.name = "ApiResponseError";
    this.status = args.status;
    this.method = args.method;
    this.path = args.path;
    this.requestId = args.requestId;
    this.body = args.body;
  }
}

function buildLogSuffix(args: { status?: number; requestId?: string; durationMs: number; message?: string }) {
  const parts = [`durationMs=${args.durationMs}`];
  if (args.status !== undefined) parts.unshift(`status=${args.status}`);
  if (args.requestId) parts.push(`requestId=${args.requestId}`);
  if (args.message) parts.push(`message=${args.message}`);
  return parts.join(" ");
}

function getErrorMessage(body: unknown, fallback: string) {
  if (body && typeof body === "object") {
    const record = body as ApiErrorBody;
    if (record.message) return record.message;
    if (record.error) return record.error;
  }
  if (typeof body === "string" && body.trim()) return body.trim();
  return fallback;
}

function describeError(err: unknown, fallback: string) {
  if (err instanceof ApiResponseError) return err.message;
  if (err instanceof Error && err.message) return err.message;
  return fallback;
}

async function parseResponseBody(response: Response): Promise<unknown> {
  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    try {
      return await response.json();
    } catch {
      return null;
    }
  }

  try {
    const text = await response.text();
    return text || null;
  } catch {
    return null;
  }
}

export async function apiRequest<T>(
  method: ApiMethod,
  path: string,
  execute: () => Promise<Response>
): Promise<T> {
  const startedAt = Date.now();
  if (SHOULD_LOG_VERBOSE) {
    console.log(`[API] -> ${method} ${path}`);
  }

  try {
    const response = await execute();
    const body = await parseResponseBody(response);
    const requestId =
      response.headers.get("x-request-id") ||
      (body && typeof body === "object" ? (body as ApiErrorBody).requestId : undefined) ||
      undefined;
    const durationMs = Date.now() - startedAt;

    if (!response.ok) {
      const message = getErrorMessage(body, `${method} ${path} failed (${response.status})`);
      const error = new ApiResponseError({
        status: response.status,
        method,
        path,
        message,
        requestId,
        body,
      });
      console.error(`[API] <- ${method} ${path} ${buildLogSuffix({ status: response.status, requestId, durationMs, message })}`);
      throw error;
    }

    if (SHOULD_LOG_VERBOSE) {
      console.log(`[API] <- ${method} ${path} ${buildLogSuffix({ status: response.status, requestId, durationMs })}`);
    }
    return body as T;
  } catch (err) {
    if (!(err instanceof ApiResponseError)) {
      console.error(`[API] xx ${method} ${path} ${buildLogSuffix({ durationMs: Date.now() - startedAt, message: describeError(err, "Network error") })}`);
    }
    throw err;
  }
}

export function formatApiError(err: unknown, fallback: string) {
  const message = describeError(err, fallback);
  if (err instanceof ApiResponseError && err.requestId) {
    return `${message}\nRequest ID: ${err.requestId}`;
  }
  return message;
}
