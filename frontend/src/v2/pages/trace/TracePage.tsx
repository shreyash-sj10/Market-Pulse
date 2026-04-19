import { Link } from "react-router-dom";
import AppLayout from "../../layout/AppLayout/AppLayout.jsx";
import { useTraceData } from "../../hooks/useTraceData";
import { ROUTES } from "../../routing/routes";
import type { TraceTimelineEntry } from "./buildTraceTimeline";

function kindClass(kind: TraceTimelineEntry["kind"]): string {
  return `trace-sys__kind trace-sys__kind--${kind.toLowerCase()}`;
}

function TraceSkeleton() {
  return (
    <ol className="trace-sys__tl trace-sys__tl--skeleton" aria-busy="true" aria-label="Loading trace">
      {[0, 1, 2, 3].map((i) => (
        <li key={i} className="trace-sys__row trace-sys__row--skeleton" />
      ))}
    </ol>
  );
}

export default function TracePage() {
  const { entries, isLoading, isError, isDegraded } = useTraceData();
  const showBanner = isDegraded || (isError && entries.length > 0);

  return (
    <AppLayout>
      <div className="home-terminal trace-sys">
        <header className="trace-sys__head">
          <h1 className="trace-sys__title">Trace</h1>
          <p className="trace-sys__lead">System decision timeline — execution, warnings, and blocks</p>
        </header>

        {showBanner && (
          <div className="data-degraded-banner trace-sys__banner" role="status">
            Trace feed degraded — some rows may be missing.
          </div>
        )}

        {isLoading && entries.length === 0 ? (
          <TraceSkeleton />
        ) : isError && entries.length === 0 ? (
          <p className="page-note trace-sys__note">Trace feed unavailable. Retry after refresh.</p>
        ) : !isLoading && entries.length === 0 ? (
          <div className="trace-sys__empty">
            <p className="trace-sys__empty-text">
              No system activity yet
              <br />
              Execute trades to generate trace history
            </p>
            <Link className="trace-sys__cta" to={ROUTES.markets}>
              Go to Markets
            </Link>
          </div>
        ) : (
          <ol className="trace-sys__tl" aria-label="System trace timeline">
            {entries.map((e) => (
              <li key={e.id} className="trace-sys__row">
                <div className="trace-sys__rail" aria-hidden="true" />
                <div className="trace-sys__body">
                  <div className="trace-sys__headrow">
                    <time className="trace-sys__time" dateTime={e.iso}>
                      {e.timeLabel}
                    </time>
                    <span className={kindClass(e.kind)}>{e.kind}</span>
                    <span className="trace-sys__src">{e.sourceType}</span>
                  </div>
                  <p className="trace-sys__summary">{e.eventSummary}</p>
                  <dl className="trace-sys__dl">
                    {e.decision ? (
                      <div className="trace-sys__dl-row">
                        <dt>Decision</dt>
                        <dd>
                          {e.decision.action} · {e.decision.confidence}%
                        </dd>
                      </div>
                    ) : null}
                    <div className="trace-sys__dl-row">
                      <dt>Confidence</dt>
                      <dd>{e.confidence != null ? `${e.confidence}%` : "—"}</dd>
                    </div>
                    <div className="trace-sys__dl-row">
                      <dt>Reason</dt>
                      <dd>{e.reason.trim() ? e.reason : "—"}</dd>
                    </div>
                  </dl>
                </div>
              </li>
            ))}
          </ol>
        )}
      </div>
    </AppLayout>
  );
}
