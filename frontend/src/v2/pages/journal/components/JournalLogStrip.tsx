import type { AccentTone, EngineLinkFocus, JournalLogVm, LearningEngineModel } from "../journalIntelligence";
import {
  confidenceReadoutLabel,
  confidenceRingTooltip,
  logMatchesEngineLink,
  primaryBehaviorType,
  secondaryTagLine,
  visualAccent,
} from "../journalIntelligence";

function accentArticleClass(accent: AccentTone): string {
  if (accent === "critical") return "journal-log-strip--accent-critical";
  if (accent === "warning") return "journal-log-strip--accent-warning";
  if (accent === "positive") return "journal-log-strip--accent-positive";
  return "journal-log-strip--accent-none";
}

function accentBarClass(accent: AccentTone): string {
  if (accent === "critical") return "journal-log-strip__accent journal-log-strip__accent--critical";
  if (accent === "warning") return "journal-log-strip__accent journal-log-strip__accent--warning";
  if (accent === "positive") return "journal-log-strip__accent journal-log-strip__accent--positive";
  return "journal-log-strip__accent journal-log-strip__accent--none";
}

function confidenceBandClass(pct: number): string {
  if (pct >= 78) return "journal-conf--high";
  if (pct >= 58) return "journal-conf--mid";
  return "journal-conf--low";
}

function confidenceRowClass(pct: number): string {
  if (pct >= 78) return "journal-log-strip--conf-high";
  if (pct >= 58) return "journal-log-strip--conf-mid";
  return "journal-log-strip--conf-low";
}

function bodyLayoutClass(archetype: JournalLogVm["archetype"]): string {
  if (archetype === "STOPPED_OUT") return "journal-log-strip__body--stopped-out";
  if (archetype === "OVERHOLD") return "journal-log-strip__body--overhold";
  if (archetype === "IMPULSIVE") return "journal-log-strip__body--impulsive";
  return "";
}

function ConfidenceReadout({ pct, matchingEntries }: { pct: number; matchingEntries: number }) {
  const p = Math.min(100, Math.max(0, pct));
  const frac = p / 100;
  const band = confidenceBandClass(p);
  const readout = confidenceReadoutLabel(p);
  const tip = confidenceRingTooltip(p, matchingEntries);
  return (
    <div className={`journal-conf ${band}`} title={tip}>
      <div
        className="journal-conf__ring"
        style={{ ["--journal-conf-pct" as string]: String(frac) }}
      />
      <div className="journal-conf__meta">
        <span className={`journal-conf__band journal-conf__band--${readout.toLowerCase()}`}>{readout}</span>
        <span className="journal-conf__pct">{p}%</span>
      </div>
    </div>
  );
}

type Props = {
  log: JournalLogVm;
  engine: LearningEngineModel;
  engineLink: EngineLinkFocus;
};

export default function JournalLogStrip({ log, engine, engineLink }: Props) {
  const accent = visualAccent(log, engine);
  const primaryType = primaryBehaviorType(log);
  const tagSecondary = secondaryTagLine(log);
  const layout = bodyLayoutClass(log.archetype);
  const confW = confidenceRowClass(log.confidence);

  const bullets =
    log.correctionBullets.length > 0
      ? log.correctionBullets
      : ["Attach concrete corrective steps on the ticket."];

  const linked =
    engineLink != null && logMatchesEngineLink(log, engineLink, engine);

  return (
    <article
      className={`journal-log-strip ${accentArticleClass(accent)}${confW}${linked ? " journal-log-strip--linked" : ""}`}
      aria-label={`Journal ${log.symbol}`}
    >
      {accent !== "none" ? <div className={accentBarClass(accent)} aria-hidden /> : null}
      <div className={`journal-log-strip__body ${layout}`.trim()}>
        <div className="journal-log-strip__left">
          <div className="journal-log-strip__type-primary">{primaryType}</div>
          {tagSecondary ? (
            <div className="journal-log-strip__type-secondary">{tagSecondary}</div>
          ) : null}
          <div className="journal-log-strip__symbol-row">
            <span className="journal-log-strip__symbol">{log.symbol}</span>
          </div>
          <div className="journal-log-strip__date">{log.dateLabel}</div>
        </div>
        <div className="journal-log-strip__center">
          <p className="journal-log-strip__lead">{log.centerPrimary}</p>
          <p className="journal-log-strip__sub">{log.behavioralWhy}</p>
        </div>
        <div className="journal-log-strip__right">
          <div className="journal-log-strip__action-rail">
            <div className="journal-log-strip__protocol-head">
              <span className="journal-log-strip__protocol-title">Protocol</span>
              <span className="journal-log-strip__protocol-hint">Execute</span>
            </div>
            <ul className="journal-log-strip__protocol">
              {bullets.map((b, i) => (
                <li key={`${i}-${b.slice(0, 24)}`}>{b}</li>
              ))}
            </ul>
            <ConfidenceReadout pct={log.confidence} matchingEntries={log.fingerprintMatchCount} />
          </div>
        </div>
      </div>
    </article>
  );
}
