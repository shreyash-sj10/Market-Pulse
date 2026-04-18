import AppLayout from "../../layout/AppLayout/AppLayout.jsx";
import { useTraceData } from "../../hooks/useTraceData";
import { DATA_UNAVAILABLE_COPY, EMPTY_STATE_COPY } from "../../copy/uiCopy";

function parseLogType(text: string): string {
  if (/\[EXEC\]/.test(text))     return "EXEC";
  if (/\[WARN\]/.test(text))     return "WARN";
  if (/\[ERR\]/.test(text))      return "ERR";
  if (/DECISION ACT/i.test(text))return "EXEC";
  if (/BLOCK/i.test(text))       return "WARN";
  if (/GUARD|GUARD/i.test(text)) return "INFO";
  return "INFO";
}

function typeClass(t: string): string {
  switch (t) {
    case "EXEC": return "event-log__type--exec";
    case "WARN": return "event-log__type--warn";
    case "ERR":  return "event-log__type--err";
    default:     return "event-log__type--info";
  }
}

function TraceSkeleton() {
  return (
    <ol className="trace-timeline trace-timeline--skeleton" aria-busy="true" aria-label="Loading trace">
      {[0, 1, 2, 3].map((i) => (
        <li key={i} className="trace-line trace-line--skeleton" />
      ))}
    </ol>
  );
}

export default function TracePage() {
  const { lines, isLoading, isError, isDegraded } = useTraceData();
  const showBanner = isDegraded || (isError && lines.length > 0);

  return (
    <AppLayout>
      <div className="trace-page">
        <div style={{ marginBottom: "var(--space-5)" }}>
          <h1 style={{
            fontSize: "var(--text-lg)",
            fontWeight: "var(--font-bold)",
            color: "var(--v2-text-primary)",
            margin: 0,
          }}>
            System Trace
          </h1>
          <p style={{
            fontSize: "var(--text-sm)",
            color: "var(--v2-text-muted)",
            margin: "var(--space-1) 0 0",
          }}>
            Decision and execution timeline.
          </p>
        </div>

        {showBanner && (
          <div className="data-degraded-banner" style={{ marginBottom: "var(--space-4)" }} role="status">
            {DATA_UNAVAILABLE_COPY}
          </div>
        )}

        {isLoading && lines.length === 0 ? (
          <TraceSkeleton />
        ) : isError && lines.length === 0 ? (
          <div className="t-section">
            <div className="t-section__body">
              <p className="page-note">{DATA_UNAVAILABLE_COPY}</p>
            </div>
          </div>
        ) : !isLoading && lines.length === 0 ? (
          <div className="t-section">
            <div className="t-section__body">
              <p className="page-note">{EMPTY_STATE_COPY}</p>
            </div>
          </div>
        ) : (
          <ol className="trace-timeline" aria-label="Trace timeline">
            {lines.map((line) => {
              const type = parseLogType(line.text);
              return (
                <li key={line.id} className="trace-line trace-line--enriched">
                  <span className="trace-line__log">{line.text}</span>
                  <span className={`event-log__type ${typeClass(type)}`} style={{ textAlign: "right", display: "block" }}>
                    {line.decisionSummary}
                  </span>
                  <span className="trace-line__reason">{line.reason}</span>
                </li>
              );
            })}
          </ol>
        )}
      </div>
    </AppLayout>
  );
}
