import type { JournalPageStatus } from "../../hooks/useJournalDecisions";
import type { JournalLogVm, LearningEngineModel } from "./journalIntelligence";
import { buildProfileBehaviorModel } from "../profile/buildProfileBehaviorModel";
import { buildProfileEnforcementLines } from "../profile/buildProfileEnforcementLines";

export type JournalEntryRowVm = {
  id: string;
  tradeSummary: string;
  /** Short mood label for chip; null if not logged. */
  moodLabel: string | null;
  decision: string;
  outcome: string;
  mistake: string;
  correction: string;
};

export type JournalPageViewModel = {
  loading: boolean;
  isDegraded: boolean;
  isError: boolean;
  journalStatusLabel: string;
  entryCount: number;
  learningStateLabel: string;
  /** Single-line summary for section 1 */
  systemStateSummary: string;
  showPrimaryAction: boolean;
  entries: JournalEntryRowVm[];
  patternLines: string[];
  systemResponseLines: string[];
};

function outcomeForLog(log: JournalLogVm): string {
  if (log.archetype === "STOPPED_OUT") return "Planned risk exit honored";
  if (log.archetype === "OVERHOLD") return "Hold extended past exit plan";
  if (log.archetype === "IMPULSIVE") return "Reactive timing / impulse pressure";
  return log.centerKind === "observation" ? "Round-trip logged — review surfaced" : "Close processed — review attached";
}

function correctionText(log: JournalLogVm): string {
  const b = log.correctionBullets.filter(Boolean);
  if (b.length === 0) return "Add explicit corrective steps on the next ticket before entry.";
  return b.slice(0, 4).join(" ");
}

function entryRow(log: JournalLogVm): JournalEntryRowVm {
  const mood =
    log.preTradeEmotion && String(log.preTradeEmotion).trim()
      ? String(log.preTradeEmotion).trim().toUpperCase()
      : null;
  return {
    id: log.id,
    tradeSummary: `${log.symbol} · ${log.dateLabel}`,
    moodLabel: mood,
    decision: log.decisionAction,
    outcome: outcomeForLog(log),
    mistake: log.centerPrimary.trim() || "—",
    correction: correctionText(log),
  };
}

function learningStateLabel(n: number): string {
  if (n === 0) return "Cold — no closed surfaces yet";
  if (n < 3) return "Warming — sparse signal";
  return "Engaged — anchored on your last closes";
}

function journalStatus(journal: JournalPageStatus): string {
  if (journal.isLoading) return "Syncing";
  if (journal.isDegraded) return "Degraded";
  if (journal.isError) return "Unavailable";
  if (journal.logs.length === 0) return "Inactive";
  return "Active";
}

function buildPatternLines(logs: JournalLogVm[], engine: LearningEngineModel): string[] {
  const lines: string[] = [];
  const n = logs.length;
  if (n === 0) return lines;

  let imp = 0;
  let over = 0;
  let stop = 0;
  for (const l of logs) {
    if (l.archetype === "IMPULSIVE") imp += 1;
    if (l.archetype === "OVERHOLD") over += 1;
    if (l.archetype === "STOPPED_OUT") stop += 1;
  }

  if (imp >= 2) {
    lines.push("Reactive or late entries clustered — sequencing tightened on the next initiations.");
  } else if (imp >= 1) {
    lines.push("Late or momentum-driven entries flagged in this window.");
  }

  if (over >= 1) {
    lines.push("Planned exits or stops deferred while the trade was still open against plan.");
  }

  if (stop >= 2 && imp + over <= 1) {
    lines.push("Risk exits honored when the journal tagged a stop-class close.");
  }

  const bias = engine.biasLabel?.trim();
  if (bias && bias !== "—" && bias !== "None surfaced") {
    lines.push(`${bias} behavior repeated across multiple closes — carry forward as the primary watch.`);
  }

  if (engine.recurrenceCount >= 2 && engine.recurrenceLabel && engine.recurrenceLabel !== "—") {
    const short = engine.recurrenceLabel.length > 96 ? `${engine.recurrenceLabel.slice(0, 94)}…` : engine.recurrenceLabel;
    lines.push(`Same mistake theme resurfacing: ${short}`);
  }

  if (lines.length === 0) {
    lines.push("No dominant behavioral class yet — keep journaling every close so the engine can lock a pattern.");
  }

  return lines.slice(0, 5);
}

export function buildJournalPageViewModel(journal: JournalPageStatus): JournalPageViewModel {
  const { logs, engine, behavioral, isLoading, isDegraded, isError } = journal;
  const entryCount = logs.length;
  const learnLabel = learningStateLabel(entryCount);

  const status = journalStatus(journal);
  const systemStateSummary =
    isLoading
      ? "Journal syncing — pull latest closes from the server."
      : isError
        ? "Journal unavailable — retry after refresh."
        : entryCount === 0
          ? "Journal inactive — no entries yet"
          : `Journal active — ${entryCount} closed surface${entryCount === 1 ? "" : "s"} in window`;

  const behaviorModel = entryCount > 0 ? buildProfileBehaviorModel(logs, engine) : null;
  const systemResponseLines =
    entryCount > 0
      ? buildProfileEnforcementLines(behaviorModel, behavioral, null)
      : [
          behavioral.systemAction.replace(/^MANDATORY:\s*/i, "").trim() || behavioral.systemAction,
          behavioral.performanceImpact.replace(/^Constraint:\s*/i, "").replace(/^Impact:\s*/i, "").trim(),
        ].filter(Boolean);

  const patternLines = buildPatternLines(logs, engine);

  return {
    loading: isLoading,
    isDegraded,
    isError,
    journalStatusLabel: status,
    entryCount,
    learningStateLabel: learnLabel,
    systemStateSummary,
    showPrimaryAction: !isLoading && entryCount === 0 && !isError,
    entries: logs.map(entryRow),
    patternLines,
    systemResponseLines,
  };
}
