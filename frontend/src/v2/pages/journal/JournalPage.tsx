import { useMemo } from "react";
import { Link } from "react-router-dom";
import AppLayout from "../../layout/AppLayout/AppLayout.jsx";
import { useJournalPage } from "../../hooks/useJournalDecisions";
import { ROUTES } from "../../routing/routes";
import { buildJournalPageViewModel } from "./buildJournalPageViewModel";

export default function JournalPage() {
  const journal = useJournalPage();
  const vm = useMemo(() => buildJournalPageViewModel(journal), [journal]);

  return (
    <AppLayout>
      <div className="home-terminal journal-learn">
        <header className="journal-learn__head">
          <h1 className="journal-learn__title">Journal</h1>
          <p className="journal-learn__subtitle">Input → feedback → learning loop</p>
        </header>

        {vm.isDegraded && (
          <div className="data-degraded-banner journal-learn__banner" role="status">
            Partial window — live journal sync degraded; entries shown may be incomplete.
          </div>
        )}

        {/* SECTION 1 — SYSTEM STATE */}
        <section className="journal-learn__block journal-learn__block--state" aria-label="Journal system state">
          <p className="journal-learn__state-line">{vm.systemStateSummary}</p>
          <p className="journal-learn__state-meta">
            <span className="journal-learn__state-k">Status</span>
            <span className="journal-learn__state-v">{vm.journalStatusLabel}</span>
            <span className="journal-learn__state-dot" aria-hidden="true">
              ·
            </span>
            <span className="journal-learn__state-k">Entries</span>
            <span className="journal-learn__state-v journal-learn__state-v--mono">{vm.entryCount}</span>
            <span className="journal-learn__state-dot" aria-hidden="true">
              ·
            </span>
            <span className="journal-learn__state-k">Learning</span>
            <span className="journal-learn__state-v">{vm.learningStateLabel}</span>
          </p>
        </section>

        {/* SECTION 2 — PRIMARY ACTION */}
        {vm.showPrimaryAction ? (
          <section className="journal-learn__block journal-learn__block--primary" aria-label="Activate learning">
            <p className="journal-learn__primary-text">Start logging your trades to activate learning</p>
            <Link className="journal-learn__cta" to={ROUTES.markets}>
              Go to Markets
            </Link>
          </section>
        ) : null}

        {vm.loading ? (
          <p className="journal-learn__muted journal-learn__loading">Syncing closes from the server — entries appear here when ready.</p>
        ) : vm.isError ? (
          <section className="journal-learn__block" aria-live="polite">
            <p className="journal-learn__muted">Journal feed could not be loaded. Check connection and try again.</p>
            <Link className="journal-learn__cta journal-learn__cta--ghost" to={ROUTES.markets}>
              Go to Markets
            </Link>
          </section>
        ) : vm.entryCount === 0 ? (
          <section className="journal-learn__block journal-learn__muted" aria-label="Guidance">
            <p>
              Every closed round-trip writes a learning surface. Open Markets, execute, and close with reflection so
              this page fills with mistakes, corrections, and system response.
            </p>
          </section>
        ) : (
          <>
            {/* SECTION 3 — RECENT ENTRIES */}
            <section className="journal-learn__block" aria-label="Recent journal entries">
              <h2 className="journal-learn__h">Recent entries</h2>
              <ol className="journal-learn__entries">
                {vm.entries.map((e) => (
                  <li key={e.id} className="journal-learn__entry">
                    <p className="journal-learn__entry-line">
                      <span className="journal-learn__k">Trade</span>
                      <span className="journal-learn__v journal-learn__trade-val">
                        <span className="journal-learn__v--mono">{e.tradeSummary}</span>
                        {e.moodLabel ? (
                          <span
                            className="journal-learn__mood-chip"
                            title="How you felt when you opened this position (self-reported)"
                          >
                            {e.moodLabel}
                          </span>
                        ) : null}
                      </span>
                    </p>
                    <p className="journal-learn__entry-line">
                      <span className="journal-learn__k">Decision</span>
                      <span className="journal-learn__v">{e.decision}</span>
                    </p>
                    <p className="journal-learn__entry-line">
                      <span className="journal-learn__k">Outcome</span>
                      <span className="journal-learn__v">{e.outcome}</span>
                    </p>
                    <p className="journal-learn__entry-line">
                      <span className="journal-learn__k">Mistake</span>
                      <span className="journal-learn__v">{e.mistake}</span>
                    </p>
                    <p className="journal-learn__entry-line">
                      <span className="journal-learn__k">Correction</span>
                      <span className="journal-learn__v">{e.correction}</span>
                    </p>
                  </li>
                ))}
              </ol>
            </section>

            {/* SECTION 4 — PATTERN DETECTION */}
            <section className="journal-learn__block" aria-label="Detected patterns">
              <h2 className="journal-learn__h">Detected behavioral patterns</h2>
              <ul className="journal-learn__bullets">
                {vm.patternLines.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </section>

            {/* SECTION 5 — SYSTEM RESPONSE */}
            <section className="journal-learn__block" aria-label="System response">
              <h2 className="journal-learn__h">System response</h2>
              <ul className="journal-learn__rules">
                {vm.systemResponseLines.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </section>
          </>
        )}

        {/* SECTION 6 — LEARNING FEEDBACK (always) */}
        <footer className="journal-learn__footer">
          <p className="journal-learn__footer-line">More data improves system accuracy</p>
        </footer>
      </div>
    </AppLayout>
  );
}
