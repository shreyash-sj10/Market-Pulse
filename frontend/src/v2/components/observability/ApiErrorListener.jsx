import { useEffect, useState, useCallback } from "react";

/**
 * Subscribes to global API error events (dispatched from axios / React Query).
 * Minimal banner — additive, does not replace page-level UX.
 */
export default function ApiErrorListener() {
  const [banner, setBanner] = useState(null);

  const dismiss = useCallback(() => setBanner(null), []);

  useEffect(() => {
    const handler = (e) => {
      const detail = e.detail || {};
      setBanner({
        message: detail.message || "Request failed",
        traceId: detail.traceId || null,
        retryable: Boolean(detail.retryable),
      });
    };
    window.addEventListener("app:api-error", handler);
    return () => window.removeEventListener("app:api-error", handler);
  }, []);

  if (!banner) return null;

  return (
    <div
      role="alert"
      className="fixed bottom-4 left-1/2 z-[9999] flex max-w-lg -translate-x-1/2 flex-col gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950 shadow-lg"
    >
      <div className="font-medium">{banner.message}</div>
      {banner.traceId ? (
        <div className="font-mono text-xs text-amber-800/90">
          Reference: {banner.traceId}
        </div>
      ) : null}
      <div className="flex gap-2">
        {banner.retryable ? (
          <button
            type="button"
            className="rounded bg-amber-800 px-2 py-1 text-xs font-semibold text-white hover:bg-amber-900"
            onClick={() => window.location.reload()}
          >
            Retry
          </button>
        ) : null}
        <button
          type="button"
          className="rounded border border-amber-300 px-2 py-1 text-xs font-medium text-amber-900 hover:bg-amber-100"
          onClick={dismiss}
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}
