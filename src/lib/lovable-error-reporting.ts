type LovableErrorOptions = {
  mechanism?: "manual" | "onerror" | "unhandledrejection" | "react_error_boundary";
  handled?: boolean;
  severity?: "error" | "warning" | "info";
};

type LovableEvents = {
  captureException?: (
    error: unknown,
    context?: Record<string, unknown>,
    options?: LovableErrorOptions,
  ) => void;
};

declare global {
  interface Window {
    __lovableEvents?: LovableEvents;
    __lovableReportRuntimeError?: (payload: {
      message: string;
      stack?: string;
      filename?: string;
    }) => void;
  }
}

export function reportLovableError(error: unknown, context: Record<string, unknown> = {}) {
  if (typeof window === "undefined") return;
  window.__lovableEvents?.captureException?.(
    error,
    {
      source: "react_error_boundary",
      route: window.location.pathname,
      ...context,
    },
    {
      mechanism: "react_error_boundary",
      handled: false,
      severity: "error",
    },
  );
  // Prod React does not rethrow boundary-caught errors to window.onerror, so the
  // editor's telemetry never sees them. Forward to lovable.js's reporting hook,
  // which is present only inside the editor preview.
  // Loaders and server fns commonly throw a raw Response; String(it) is the
  // opaque "[object Response]", so pull out the status and URL instead.
  const message =
    error instanceof Response
      ? `Response ${error.status}${error.url ? ` at ${error.url}` : ""}`
      : error instanceof Error
        ? error.message
        : String(error);
  const stack = error instanceof Error ? error.stack : undefined;
  window.__lovableReportRuntimeError?.({
    message,
    ...(stack !== undefined && { stack }),
    filename: window.location.pathname,
  });

  // Error boundaries do not bubble to the server in production. Keep a small,
  // redacted breadcrumb in the web access log so a client-side render failure
  // can be diagnosed even when the browser console is unavailable. The query
  // is intentionally capped and contains only the error class/message and
  // current route; no session data or stack trace is sent.
  const breadcrumb = `${error instanceof Error ? error.name : "RuntimeError"}: ${message}`
    .replace(/[\r\n\t]+/g, " ")
    .slice(0, 320);
  const route = window.location.pathname.slice(0, 160);
  const url = `/api/client-runtime-error?message=${encodeURIComponent(breadcrumb)}&route=${encodeURIComponent(route)}`;
  void fetch(url, { method: "GET", credentials: "same-origin", cache: "no-store", keepalive: true }).catch(() => undefined);
}
