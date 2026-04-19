/**
 * Normalize Axios/fetch errors for UI + logging (additive observability).
 */

export function normalizeApiError(error) {
  const res = error?.response;
  const data = res?.data;
  const headers = res?.headers || {};
  const traceId =
    headers["x-trace-id"] ||
    headers["X-Trace-Id"] ||
    data?.traceId ||
    data?.meta?.traceId ||
    data?.error?.traceId ||
    null;

  const apiError = data?.error;
  const code =
    apiError?.code ||
    (res?.status >= 500 ? "INTERNAL_ERROR" : "REQUEST_ERROR");
  const message =
    apiError?.message ||
    (typeof data?.message === "string" ? data.message : null) ||
    error?.message ||
    "Something went wrong. Please try again.";

  const retryable = Boolean(apiError?.retryable);

  return {
    status: res?.status ?? null,
    code,
    message,
    traceId,
    retryable,
    raw: error,
  };
}
