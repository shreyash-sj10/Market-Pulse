import { useMemo } from "react";
import { Link } from "react-router-dom";
import AppLayout from "../../layout/AppLayout/AppLayout.jsx";
import { useAuth } from "../../../features/auth/AuthContext.jsx";
import { useJournalPage } from "../../hooks/useJournalDecisions";
import { useUserProfileEnvelope } from "../../hooks/useUserProfileEnvelope";
import { ROUTES } from "../../routing/routes";
import { buildProfilePageViewModel } from "./buildProfilePageViewModel";

function identityLabel(status: string): string {
  switch (status) {
    case "NONE":
      return "Not built";
    case "PARTIAL":
      return "Partial";
    case "STALE":
      return "Stale";
    case "ACTIVE":
      return "Live";
    default:
      return status;
  }
}

function linkLabel(status: string): string {
  switch (status) {
    case "SYNC":
      return "Sync";
    case "LIVE":
      return "Live";
    case "DEGRADED":
      return "Degraded";
    case "OFFLINE":
      return "Offline";
    default:
      return status;
  }
}

export default function ProfilePage() {
  const { user } = useAuth();
  const journal = useJournalPage();
  const { profile, isLoading: profileLoading } = useUserProfileEnvelope();

  const displayName = user?.name?.trim() || user?.email?.split("@")[0] || "Operator";

  const vm = useMemo(
    () => buildProfilePageViewModel(journal, profile, profileLoading, { username: displayName }),
    [journal, profile, profileLoading, displayName],
  );

  return (
    <AppLayout>
      <div className="home-terminal profile-sys">
        <header className="profile-sys__page-head">
          <h1 className="profile-sys__page-title">Profile</h1>
          <p className="profile-sys__page-lead">Behavioral intelligence · enforcement · pattern load</p>
        </header>

        {vm.loading ? (
          <p className="page-loading page-note">Loading behavioral profile…</p>
        ) : vm.isEmpty ? (
          <div className="profile-sys__empty-block">
            <p className="profile-sys__empty-text">
              No behavioral model yet
              <br />
              Start trading and logging decisions to build your profile
            </p>
            <Link className="profile-sys__cta profile-sys__cta--primary" to={ROUTES.markets}>
              Go to Markets
            </Link>
          </div>
        ) : (
          <>
            {(vm.profileStale || vm.journalDegraded || vm.profileDegraded) && (
              <div className="data-degraded-banner profile-sys__banner" role="status">
                {vm.profileStale && <span>Model STALE — pending reflections. </span>}
                {vm.journalDegraded && <span>Journal path degraded. </span>}
                {vm.profileDegraded && <span>Telemetry incomplete.</span>}
              </div>
            )}

            {/* SECTION 1 — IDENTITY + STATE */}
            <section className="profile-sys__identity" aria-label="Operator identity and link state">
              <span className="profile-sys__id-item">
                <span className="profile-sys__id-k">User</span>
                <span className="profile-sys__id-v profile-sys__id-v--mono">{vm.identity.username}</span>
              </span>
              <span className="profile-sys__id-sep" aria-hidden="true" />
              <span className="profile-sys__id-item">
                <span className="profile-sys__id-k">Link</span>
                <span className={`profile-sys__id-v profile-sys__id-v--state profile-sys__id-v--${vm.identity.connectionStatus.toLowerCase()}`}>
                  {linkLabel(vm.identity.connectionStatus)}
                </span>
              </span>
              <span className="profile-sys__id-sep" aria-hidden="true" />
              <span className="profile-sys__id-item">
                <span className="profile-sys__id-k">Model</span>
                <span className="profile-sys__id-v">{identityLabel(vm.identity.behaviorModelStatus)}</span>
              </span>
              <span className="profile-sys__id-sep" aria-hidden="true" />
              <span className="profile-sys__id-item">
                <span className="profile-sys__id-k">Trades</span>
                <span className="profile-sys__id-v profile-sys__id-v--mono">{vm.identity.tradesLoggedDisplay}</span>
              </span>
              <span className="profile-sys__id-sep" aria-hidden="true" />
              <span className="profile-sys__id-item">
                <span className="profile-sys__id-k">Last activity</span>
                <span className="profile-sys__id-v profile-sys__id-v--mono">{vm.identity.lastActivityDisplay}</span>
              </span>
            </section>

            {/* SECTION 2 — METRICS STRIP */}
            <section className="profile-sys__strip" aria-label="Risk and performance metrics">
              <div className="profile-sys__metric">
                <span className="profile-sys__metric-label">Win rate</span>
                <span className="profile-sys__metric-value">{vm.stateStrip.winRateDisplay}</span>
              </div>
              <div className="profile-sys__metric">
                <span className="profile-sys__metric-label">Avg risk</span>
                <span className="profile-sys__metric-value">{vm.stateStrip.avgRiskDisplay}</span>
              </div>
              <div className="profile-sys__metric">
                <span className="profile-sys__metric-label">Drawdown</span>
                <span className="profile-sys__metric-value">{vm.stateStrip.maxDrawdownDisplay}</span>
              </div>
              <div className="profile-sys__metric">
                <span className="profile-sys__metric-label">Consistency</span>
                <span className="profile-sys__metric-value">{vm.stateStrip.consistencyDisplay}</span>
              </div>
            </section>

            {/* SECTION 3 — BEHAVIOR INSIGHTS */}
            <section className="profile-sys__section" aria-label="Behavior insights">
              <h2 className="profile-sys__section-title">Behavior insights</h2>
              {vm.insights.map((row, idx) => (
                <article key={`${row.identifiedPattern.slice(0, 48)}-${idx}`} className="profile-sys__insight">
                  <h3 className="profile-sys__insight-pattern">{row.identifiedPattern}</h3>
                  <p className="profile-sys__insight-row">
                    <span className="profile-sys__insight-k">Correction</span>
                    {row.correction}
                  </p>
                  <p className="profile-sys__insight-row">
                    <span className="profile-sys__insight-k">Impact</span>
                    {row.impact}
                  </p>
                </article>
              ))}
            </section>

            {/* SECTION 4 — ACTION REQUIRED */}
            <section className="profile-sys__section" aria-label="System enforcement">
              <h2 className="profile-sys__section-title">Action required</h2>
              <ul className="profile-sys__rules">
                {vm.enforcementLines.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </section>

            {/* SECTION 5 — PATTERN SUMMARY */}
            <section className="profile-sys__section" aria-label="Pattern summary">
              <h2 className="profile-sys__section-title">Pattern summary</h2>
              <ul className="profile-sys__summary">
                {vm.patternSummaryLines.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </section>

            {/* SECTION 6 — JOURNAL */}
            <section className="profile-sys__section profile-sys__section--footer" aria-label="Journal">
              <Link className="profile-sys__cta" to={ROUTES.journal}>
                View Journal
              </Link>
            </section>
          </>
        )}
      </div>
    </AppLayout>
  );
}
