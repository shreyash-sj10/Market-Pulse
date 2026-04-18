import { useState } from "react";
import AppLayout from "../../layout/AppLayout/AppLayout.jsx";
import { useJournalPage } from "../../hooks/useJournalDecisions";
import type { EngineLinkFocus } from "../../hooks/useJournalDecisions";
import LearningEnginePanel from "./components/LearningEnginePanel";
import BehavioralInsightPanel from "./components/BehavioralInsightPanel";
import JournalLogStrip from "./components/JournalLogStrip";

export default function JournalPage() {
  const journal = useJournalPage();
  const [engineLink, setEngineLink] = useState<EngineLinkFocus>(null);

  return (
    <AppLayout>
      <div className="home-terminal journal-terminal">
        <header className="journal-terminal__header">
          <div>
            <h1 className="journal-terminal__title">Journal</h1>
            <p className="journal-terminal__lead">Behavioral intelligence · pattern detection · enforcement layer</p>
            <p className="journal-terminal__loop">
              This window feeds Profile (bias, scores, constraints) and the Trade terminal before execution — loop
              closes when trades journal on close.
            </p>
          </div>
        </header>

        {journal.isDegraded && (
          <div className="data-degraded-banner" role="status">
            Degraded mode — last known journal window; live sync unavailable
          </div>
        )}

        <LearningEnginePanel model={journal.engine} activeLink={engineLink} onSelectLink={setEngineLink} />

        <div className="home-terminal__grid journal-terminal__grid">
          <div className="home-terminal__main journal-terminal__main">
            <section className="journal-logs" aria-label="Journal logs">
              <header className="journal-logs__head">
                <h2 className="journal-logs__title">Intelligence log</h2>
              </header>
              {journal.isLoading ? (
                <p className="page-loading page-note">Loading intelligence log…</p>
              ) : journal.logs.length === 0 ? (
                <p className="page-note journal-logs__empty">No journal entries — system has no behavioral window yet.</p>
              ) : (
                <div className="journal-log-stream">
                  {journal.logs.map((log) => (
                    <JournalLogStrip
                      key={log.id}
                      log={log}
                      engine={journal.engine}
                      engineLink={engineLink}
                    />
                  ))}
                </div>
              )}
            </section>
          </div>
          <div className="home-terminal__aside journal-terminal__aside">
            <BehavioralInsightPanel model={journal.behavioral} />
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
