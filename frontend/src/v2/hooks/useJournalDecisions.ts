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

/** Buy-side entry logs from `/journal/summary` `entryLogs` (every open / executed leg). */
export type JournalEntryOpeningVm = {
  id: string;
  symbol: string;
  dateLabel: string;
  executionStatus: string;
  signalLine: string;
  thesisLine: string;
};

export type JournalPageStatus = {
  logs: JournalLogVm[];
  engine: LearningEngineModel;
  behavioral: BehavioralGuidanceModel;
  entryOpenings: JournalEntryOpeningVm[];
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

function getJournalEntryOpenings(res: unknown): JournalEntryOpeningVm[] {
  if (!res || typeof res !== "object") return [];
  const r = res as Record<string, unknown>;
  const nested = r.data as Record<string, unknown> | undefined;
  const raw = (nested?.entryLogs ?? r.entryLogs) as unknown[] | undefined;
  if (!Array.isArray(raw)) return [];
  const out: JournalEntryOpeningVm[] = [];
  for (const e of raw) {
    if (!e || typeof e !== "object") continue;
    const o = e as Record<string, unknown>;
    const sym = String(o.symbol ?? "").trim();
    if (!sym) continue;
    const id = String(o.tradeId ?? sym);
    const opened = o.openedAt != null ? new Date(String(o.openedAt)).getTime() : 0;
    const sig = o.signalVerdict != null && String(o.signalVerdict).trim() ? String(o.signalVerdict).trim() : "—";
    const score =
      o.signalScore != null && Number.isFinite(Number(o.signalScore)) ? ` · ${Number(o.signalScore)}` : "";
    const thesisRaw = o.thesis != null ? String(o.thesis).trim() : "";
    const thesisLine = thesisRaw ? (thesisRaw.length > 140 ? `${thesisRaw.slice(0, 138)}…` : thesisRaw) : "—";
    out.push({
      id,
      symbol: sym,
      dateLabel: formatJournalDate(opened),
      executionStatus: String(o.executionStatus ?? "—"),
      signalLine: `${sig}${score}`,
      thesisLine,
    });
  }
  return out;
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

  const moodRaw = entry.preTradeEmotionAtEntry;
  const preTradeEmotion =
    moodRaw != null && String(moodRaw).trim() ? String(moodRaw).trim().toUpperCase() : null;

  return {
    symbol: sym || "—",
    sortTime,
    dateLabel: formatJournalDate(sortTime),
    preTradeEmotion,
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
  entryOpenings: JournalEntryOpeningVm[];
  degraded: boolean;
  fetchFailed: boolean;
}> {
  try {
    const res = await getJournalSummary();
    const meta = (res as Record<string, unknown>).meta as Record<string, unknown> | undefined;
    const degraded = Boolean(meta?.journalWarning);
    const raw = getJournalEntries(res);
    const sorted = [...raw].sort(
      (a, b) => entrySortTime(b as Record<string, unknown>) - entrySortTime(a as Record<string, unknown>),
    );
    const rows = sorted
      .map((e) => mapJournalEntryToRow(e as Record<string, unknown>))
      .filter((x): x is JournalRowSource => x !== null);

    return { rows, entryOpenings: getJournalEntryOpenings(res), degraded, fetchFailed: false };
  } catch {
    return { rows: [], entryOpenings: [], degraded: true, fetchFailed: true };
  }
}

function buildPageStatus(
  rows: JournalRowSource[],
  entryOpenings: JournalEntryOpeningVm[],
  degraded: boolean,
  fetchFailed: boolean,
): Omit<JournalPageStatus, "isLoading"> {
  const logs = enrichJournalLogs(rows.map(journalRowToLogVm));
  return {
    logs,
    engine: deriveLearningEngine(logs),
    behavioral: deriveBehavioralGuidance(logs),
    entryOpenings,
    isError: fetchFailed,
    isDegraded: degraded,
  };
}

async function loadJournal(): Promise<JournalPageStatus> {
  const { rows, entryOpenings, degraded, fetchFailed } = await fetchJournalRows();
  return { isLoading: false, ...buildPageStatus(rows, entryOpenings, degraded, fetchFailed) };
}

export function useJournalPage(): JournalPageStatus {
  const q = useQuery({
    queryKey: queryKeys.journal,
    queryFn: loadJournal,
    staleTime: 20_000,
    refetchOnWindowFocus: false,
    retry: 1,
  });

  if (q.isPending && !q.data) {
    return {
      logs: [],
      engine: deriveLearningEngine([]),
      behavioral: deriveBehavioralGuidance([]),
      entryOpenings: [],
      isLoading: true,
      isError: false,
      isDegraded: false,
    };
  }

  return q.data ?? { isLoading: false, ...buildPageStatus([], [], true, true) };
}

/** @deprecated Use useJournalPage — kept name for grep-friendly migration */
export function useJournalDecisions(): JournalPageStatus {
  return useJournalPage();
}
