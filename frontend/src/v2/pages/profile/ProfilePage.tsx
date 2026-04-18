import { useMemo } from "react";
import { Link } from "react-router-dom";
import AppLayout from "../../layout/AppLayout/AppLayout.jsx";
import { useAuth } from "../../../features/auth/AuthContext.jsx";
import { useJournalPage } from "../../hooks/useJournalDecisions";
import { useTraceData } from "../../hooks/useTraceData";
import { ROUTES } from "../../routing/routes";
import { buildProfileBehaviorModel } from "./buildProfileBehaviorModel";
import { mapTraceLinesToProfilePreview } from "./mapTraceToProfilePreview";

function BandPill({ value }: { value: "LOW" | "MEDIUM" | "HIGH" }) {
  const cls =
    value === "HIGH"
      ? "profile-tos__pill profile-tos__pill--high"
      : value === "MEDIUM"
        ? "profile-tos__pill profile-tos__pill--mid"
        : "profile-tos__pill profile-tos__pill--low";
  return <span className={cls}>{value}</span>;
}

function ScoreBar({
  label,
  pct,
  variant,
}: {
  label: string;
  pct: number;
  variant: "exec" | "risk" | "bias";
}) {
  const w = Math.min(100, Math.max(0, Math.round(pct)));
  return (
    <div className={`profile-tos__score profile-tos__score--${variant}`}>
      <div className="profile-tos__score-head">
        <span className="profile-tos__score-label">{label}</span>
        <span className="profile-tos__score-pct">{w}%</span>
      </div>
      <div className="profile-tos__score-track" aria-hidden="true">
        <div className="profile-tos__score-fill" style={{ width: `${w}%` }} />
      </div>
    </div>
  );
}

function TendencyBar({
  label,
  count,
  total,
  variant,
}: {
  label: string;
  count: number;
  total: number;
  variant: "hold" | "stop" | "impulse";
}) {
  const pct = total > 0 ? Math.min(100, Math.round((count / total) * 100)) : 0;
  return (
    <div className={`profile-tos__t-bar profile-tos__t-bar--${variant}`}>
      <div className="profile-tos__t-head">
        <span className="profile-tos__t-label">{label}</span>
        <span className="profile-tos__t-count">
          {count} / {total}
        </span>
      </div>
      <div className="profile-tos__t-track" aria-hidden="true">
        <div className="profile-tos__t-fill" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function traceOutcomeClass(outcome: "EXECUTED" | "GUIDED" | "BLOCKED"): string {
  if (outcome === "EXECUTED") return "profile-tos__trace-outcome profile-tos__trace-outcome--executed";
  if (outcome === "BLOCKED") return "profile-tos__trace-outcome profile-tos__trace-outcome--blocked";
  return "profile-tos__trace-outcome profile-tos__trace-outcome--guided";
}

export default function ProfilePage() {
  const { user } = useAuth();
  const journal = useJournalPage();
  const trace = useTraceData();
  const displayName = user?.name ?? user?.email?.split("@")[0] ?? "Operator";

  const tracePreview = useMemo(() => mapTraceLinesToProfilePreview(trace.lines, 5), [trace.lines]);

  const model =
    !journal.isLoading && journal.logs.length > 0
      ? buildProfileBehaviorModel(journal.logs, journal.engine)
      : null;

  const hasData = model != null;

  return (
    <AppLayout>
      <div className="home-terminal profile-tos">
        {journal.isLoading ? (
          <p className="page-loading page-note">Loading operating profile…</p>
        ) : !hasData ? (
          <p className="profile-tos__empty">
            No behavioral profile available.
            <br />
            Execute trades and log decisions to build your model.
          </p>
        ) : (
          <>
            <header className="profile-tos__sysbar" aria-label="Trader operating system header">
              <div className="profile-tos__sysbar-left">
                <div className="profile-tos__avatar" aria-hidden>
                  {displayName.slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <p className="profile-tos__sysbar-name">{displayName}</p>
                  <p className="profile-tos__sysbar-role">Operator</p>
                </div>
              </div>
              <div className="profile-tos__sysbar-center">
                <div className="profile-tos__sysbar-chip">
                  <span className="profile-tos__sysbar-chip-label">Execution discipline</span>
                  <BandPill value={model.executionDiscipline} />
                </div>
                <div className="profile-tos__sysbar-chip">
                  <span className="profile-tos__sysbar-chip-label">Risk adherence</span>
                  <BandPill value={model.riskAdherence} />
                </div>
              </div>
              <p className="profile-tos__sysbar-right">
                Profile derived from <strong>{model.derivedFromTrades}</strong> trades
              </p>
            </header>

            {journal.isDegraded && (
              <div className="data-degraded-banner" role="status">
                Journal window degraded — model may be incomplete
              </div>
            )}

            <div className="home-terminal__grid profile-tos__grid">
              <div className="home-terminal__main profile-tos__main">
                <div className={`profile-tos__bias-shell profile-tos__bias-shell--${model.biasShellTone}`}>
                  <p className="profile-tos__eyebrow">Dominant bias</p>
                  <p className="profile-tos__bias-hero">{model.dominantBiasDisplay}</p>
                  <p className="profile-tos__bias-lead">{model.dominantBiasExplanation}</p>
                </div>
                <p className="profile-tos__summary">{model.behaviorSummary}</p>

                <h2 className="profile-tos__h2">Behavior scores</h2>
                <div className="profile-tos__scores">
                  <ScoreBar
                    label="Execution precision"
                    pct={model.behaviorScores.executionPrecision}
                    variant="exec"
                  />
                  <ScoreBar
                    label="Risk discipline"
                    pct={model.behaviorScores.riskDiscipline}
                    variant="risk"
                  />
                  <ScoreBar label="Bias control" pct={model.behaviorScores.biasControl} variant="bias" />
                </div>

                <section className="profile-tos__interpret" aria-label="System interpretation">
                  <h2 className="profile-tos__h2 profile-tos__h2--nested">System interpretation</h2>
                  <dl className="profile-tos__interpret-list">
                    <div className="profile-tos__interpret-row">
                      <dt>Primary issue</dt>
                      <dd>{model.systemInterpretation.primaryIssue}</dd>
                    </div>
                    <div className="profile-tos__interpret-row">
                      <dt>Secondary issue</dt>
                      <dd>{model.systemInterpretation.secondaryIssue}</dd>
                    </div>
                    <div className="profile-tos__interpret-row">
                      <dt>Impact</dt>
                      <dd>{model.systemInterpretation.impact}</dd>
                    </div>
                  </dl>
                </section>

                <h2 className="profile-tos__h2 profile-tos__h2--tight">Behavioral tendencies</h2>
                <div className="profile-tos__tendencies">
                  <TendencyBar
                    variant="hold"
                    label="Holds beyond target"
                    count={model.tendencies.holdsBeyondTarget.count}
                    total={model.tendencies.holdsBeyondTarget.total}
                  />
                  <TendencyBar
                    variant="stop"
                    label="Stops respected"
                    count={model.tendencies.stopsRespected.count}
                    total={model.tendencies.stopsRespected.total}
                  />
                  <TendencyBar
                    variant="impulse"
                    label="Impulsive entries"
                    count={model.tendencies.impulsiveEntries.count}
                    total={model.tendencies.impulsiveEntries.total}
                  />
                </div>
              </div>

              <aside className="home-terminal__aside profile-tos__aside" aria-label="System constraints">
                <h2 className="profile-tos__h2 profile-tos__h2--panel">System constraints</h2>
                <div className="profile-tos__panel">
                  <table className="profile-tos__matrix">
                    <tbody>
                      {model.enforcementRows.map((row) => (
                        <tr
                          key={row.key}
                          className={
                            row.engaged ? "profile-tos__matrix-row profile-tos__matrix-row--on" : "profile-tos__matrix-row"
                          }
                        >
                          <th scope="row" className="profile-tos__matrix-k">
                            {row.control}
                          </th>
                          <td className="profile-tos__matrix-v">{row.status}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="profile-tos__feedback" role="status" aria-live="polite">
                  <p className="profile-tos__feedback-line">{model.constraintFeedback.scalingLine}</p>
                  <p className="profile-tos__feedback-line profile-tos__feedback-line--mono">
                    {model.constraintFeedback.unlockLine}
                  </p>
                </div>

                <section className="profile-tos__trace" aria-label="Recent system trace">
                  <h2 className="profile-tos__h2 profile-tos__h2--trace">System Trace (Recent)</h2>
                  {trace.isLoading && tracePreview.length === 0 ? (
                    <p className="profile-tos__trace-empty">Loading trace…</p>
                  ) : trace.isError && tracePreview.length === 0 ? (
                    <p className="profile-tos__trace-empty">Trace unavailable.</p>
                  ) : tracePreview.length === 0 ? (
                    <p className="profile-tos__trace-empty">No trace rows yet — decisions appear after terminal activity.</p>
                  ) : (
                    <ul className="profile-tos__trace-list">
                      {tracePreview.map((row) => (
                        <li key={row.id} className="profile-tos__trace-item">
                          <div className="profile-tos__trace-rowhead">
                            <span className="profile-tos__trace-action">{row.action}</span>
                            <span className="profile-tos__trace-symbol">{row.symbol}</span>
                            <span className={traceOutcomeClass(row.outcome)}>{row.outcome}</span>
                          </div>
                          <p className="profile-tos__trace-reason">
                            Reason: <span className="profile-tos__trace-reason-tag">{row.reasonTag}</span>
                          </p>
                          <p className="profile-tos__trace-detail">{row.detail}</p>
                        </li>
                      ))}
                    </ul>
                  )}
                  {(trace.isDegraded || trace.isError) && tracePreview.length > 0 ? (
                    <p className="profile-tos__trace-note">Trace stream may be incomplete.</p>
                  ) : null}
                  <Link className="profile-tos__trace-link" to={ROUTES.trace}>
                    Open full system trace
                  </Link>
                </section>
              </aside>
            </div>
          </>
        )}
      </div>
    </AppLayout>
  );
}
