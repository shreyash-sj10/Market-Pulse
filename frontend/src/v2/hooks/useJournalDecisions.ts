/**
 * Journal system data from /journal/summary — structured logs + derived intelligence.
 */
import { useQuery } from "@tanstack/react-query";
import { getJournalSummary } from "../api/journal.api.js";
import { queryKeys } from "../queryKeys";
import { buildDecision } from "../domain/decision/buildDecision";
import type { BuildDecisionInput } from "../domain/decision/buildDecision";
import {
  deriveBehavioralGuidance,
  deriveLearningEngine,
  enrichJournalLogs,
  journalRowToLogVm,
  type BehavioralGuidanceModel,
  type EngineLinkFocus,
  type JournalLogVm,
  type JournalRowSource,
  type LearningEngineModel,
} from "../pages/journal/journalIntelligence";

export type JournalPageStatus = {
  logs: JournalLogVm[];
  engine: LearningEngineModel;
  behavioral: BehavioralGuidanceModel;
  isLoading: boolean;
  isError: boolean;
  isDegraded: boolean;
};

export type {
  JournalLogVm,
  LearningEngineModel,
  BehavioralGuidanceModel,
  EngineLinkFocus,
  JournalArchetype,
  AccentTone,
};

function getJournalEntries(res: unknown): unknown[] {
  if (!res || typeof res !== "object") return [];
  const r = res as Record<string, unknown>;
  const nested = r.data as Record<string, unknown> | undefined;
  if (nested && Array.isArray(nested.entries)) return nested.entries;
  if (Array.isArray(r.entries)) return r.entries;
  return [];
}

function entrySortTime(entry: Record<string, unknown>): number {
  const direct = entry.updatedAt ?? entry.createdAt ?? entry.timestamp;
  if (direct) return new Date(String(direct)).getTime();
  const closed = entry.closedAt;
  if (typeof closed === "number" && Number.isFinite(closed)) return closed;
  if (closed != null) {
    const t = new Date(String(closed)).getTime();
    if (Number.isFinite(t)) return t;
  }
  const opened = entry.openedAt;
  if (typeof opened === "number" && Number.isFinite(opened)) return opened;
  if (opened != null) {
    const t = new Date(String(opened)).getTime();
    if (Number.isFinite(t)) return t;
  }
  const ls = entry.learningSurface as Record<string, unknown> | undefined;
  if (ls?.updatedAt) return new Date(String(ls.updatedAt)).getTime();
  if (ls?.createdAt) return new Date(String(ls.createdAt)).getTime();
  return 0;
}

function formatJournalDate(ms: number): string {
  if (!Number.isFinite(ms) || ms <= 0) return "—";
  return new Date(ms).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function mapJournalEntryToRow(entry: Record<string, unknown>): JournalRowSource | null {
  const ls = entry.learningSurface as Record<string, unknown> | undefined;
  if (!ls) return null;

  const sym = String(entry.symbol ?? "").trim();
  let mistake = String(ls.primaryMistake ?? "").trim();
  let correction = String(ls.correction ?? "").trim();
  let insight = String(ls.insight ?? "").trim();
  const verdict = String(ls.verdict ?? "").trim();
  const sortTime = entrySortTime(entry);

  let isObservation = false;
  if (!mistake && !correction && !insight) {
    if (!sym) return null;
    mistake = sym;
    correction =
      correction || verdict || "Review plan vs execution before the next ticket.";
    insight = insight || (verdict ? `Outcome: ${verdict}.` : "Closed round-trip from your trade history.");
    isObservation = true;
  }

  const confidence = Number(ls.confidence ?? 50);
  const riskScore = Math.min(100, Math.max(0, Math.round(Number.isFinite(confidence) ? confidence : 50)));
  const tags = Array.isArray(ls.tags) ? (ls.tags as string[]).map((t) => String(t)) : [];

  const input: BuildDecisionInput = {
    allowed: true,
    riskScore,
    warnings: tags.length > 0 ? tags : false,
  };
  const decision = buildDecision(input);

  return {
    symbol: sym || "—",
    sortTime,
    dateLabel: formatJournalDate(sortTime),
    mistake: mistake || sym || "Trade reflection",
    correction: correction || "Review before next entry.",
    insight: insight || "—",
    verdict,
    tagList: tags,
    confidence: riskScore,
    allowed: input.allowed,
    riskScore,
    warnings: input.warnings,
    isObservation,
    decision,
  };
}

export async function fetchJournalRows(): Promise<{
  rows: JournalRowSource[];
  degraded: boolean;
  fetchFailed: boolean;
}> {
  try {
    const res = await getJournalSummary();
    const raw = getJournalEntries(res);
    const sorted = [...raw].sort(
      (a, b) => entrySortTime(b as Record<string, unknown>) - entrySortTime(a as Record<string, unknown>),
    );
    const rows = sorted
      .map((e) => mapJournalEntryToRow(e as Record<string, unknown>))
      .filter((x): x is JournalRowSource => x !== null);

    return { rows, degraded: false, fetchFailed: false };
  } catch {
    return { rows: [], degraded: true, fetchFailed: true };
  }
}

function buildPageStatus(
  rows: JournalRowSource[],
  degraded: boolean,
  fetchFailed: boolean,
): Omit<JournalPageStatus, "isLoading"> {
  const logs = enrichJournalLogs(rows.map(journalRowToLogVm));
  return {
    logs,
    engine: deriveLearningEngine(logs),
    behavioral: deriveBehavioralGuidance(logs),
    isError: fetchFailed,
    isDegraded: degraded,
  };
}

async function loadJournal(): Promise<JournalPageStatus> {
  const { rows, degraded, fetchFailed } = await fetchJournalRows();
  return { isLoading: false, ...buildPageStatus(rows, degraded, fetchFailed) };
}

export function useJournalPage(): JournalPageStatus {
  const q = useQuery({
    queryKey: queryKeys.journal,
    queryFn: loadJournal,
    staleTime: 0,
  });

  if (q.isPending && !q.data) {
    return {
      logs: [],
      engine: deriveLearningEngine([]),
      behavioral: deriveBehavioralGuidance([]),
      isLoading: true,
      isError: false,
      isDegraded: false,
    };
  }

  return q.data ?? { isLoading: false, ...buildPageStatus([], true, true) };
}

/** @deprecated Use useJournalPage — kept name for grep-friendly migration */
export function useJournalDecisions(): JournalPageStatus {
  return useJournalPage();
}
