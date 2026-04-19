/**
 * System trace: /trace list → adapter → timeline entries + legacy lines for Home/Portfolio.
 */
import { useQuery } from "@tanstack/react-query";
import api from "../api/api.js";
import { queryKeys } from "../queryKeys";
import { normalizeTraceList } from "../adapters/trace.adapter.js";
import { buildDecision } from "../domain/decision/buildDecision";
import type { BuildDecisionInput } from "../domain/decision/buildDecision";
import {
  buildTraceTimelineEntries,
  type TraceListItemNormalized,
  type TraceTimelineEntry,
} from "../pages/trace/buildTraceTimeline";

export type TraceLine = {
  id: string;
  text: string;
  decisionSummary: string;
  reason: string;
  sourceType?: string;
  verdict?: string;
  rawSummary?: string;
};

export type TraceDataStatus = {
  lines: TraceLine[];
  entries: TraceTimelineEntry[];
  isLoading: boolean;
  isError: boolean;
  isDegraded: boolean;
};

function logToDecisionInput(text: string): BuildDecisionInput {
  const m = text.match(/confidence[=:]\s*(\d+)/i);
  const n = m ? Number(m[1]) : NaN;
  const riskScore = Number.isFinite(n) ? Math.min(100, Math.max(0, Math.round(n))) : 50;
  if (/\bBLOCK\b/i.test(text)) return { allowed: false, riskScore, warnings: false };
  if (/\bACT\b/i.test(text)) return { allowed: true, riskScore: Math.max(70, riskScore), warnings: false };
  if (/\bGUIDE\b/i.test(text)) return { allowed: true, riskScore: Math.min(69, Math.max(50, riskScore)), warnings: true };
  return { allowed: true, riskScore, warnings: false };
}

function enrichTraceLine(
  id: string,
  text: string,
  meta: { sourceType: string; verdict: string; rawSummary: string },
): TraceLine {
  const decision = buildDecision(logToDecisionInput(text));
  return {
    id,
    text,
    decisionSummary: `${decision.action} · ${decision.confidence}%`,
    reason: decision.reason,
    sourceType: meta.sourceType,
    verdict: meta.verdict,
    rawSummary: meta.rawSummary,
  };
}

function toNormalizedList(raw: ReturnType<typeof normalizeTraceList>): TraceListItemNormalized[] {
  return raw.map((item) => ({
    id: String(item.id || item.timestamp),
    type: String(item.type ?? "UNKNOWN"),
    timestamp: String(item.timestamp ?? ""),
    verdict: item.verdict != null ? String(item.verdict) : null,
    summary: String(item.summary ?? ""),
    systemAction: item.systemAction != null ? String(item.systemAction) : null,
    confidence: typeof item.confidence === "number" && Number.isFinite(item.confidence) ? item.confidence : null,
    reason: String(item.reason ?? ""),
  }));
}

function toLegacyLines(norm: TraceListItemNormalized[]): { id: string; text: string; sourceType: string; verdict: string; rawSummary: string }[] {
  return norm.map((item) => ({
    id: item.id,
    text: `[${item.timestamp}] ${item.type} ${item.summary || ""}`.trim(),
    sourceType: item.type,
    verdict: item.verdict ?? "NEUTRAL",
    rawSummary: item.summary,
  }));
}

export type TraceFetchResult = {
  lines: TraceLine[];
  entries: TraceTimelineEntry[];
  degraded: boolean;
  fetchFailed: boolean;
};

export async function fetchTraceLines(): Promise<TraceFetchResult> {
  try {
    const response = await api.get("/trace");
    const list = normalizeTraceList(response?.data);
    const sorted = [...list].sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
    );
    const norm = toNormalizedList(sorted);
    const legacyRaw = toLegacyLines(norm);
    const lines = legacyRaw.map((r) =>
      enrichTraceLine(r.id, r.text, {
        sourceType: r.sourceType,
        verdict: r.verdict,
        rawSummary: r.rawSummary,
      }),
    );
    const entries = buildTraceTimelineEntries(norm);
    return {
      lines,
      entries,
      degraded: false,
      fetchFailed: false,
    };
  } catch {
    return { lines: [], entries: [], degraded: true, fetchFailed: true };
  }
}

async function loadTrace(): Promise<TraceDataStatus> {
  const { lines, entries, degraded, fetchFailed } = await fetchTraceLines();
  return { lines, entries, isLoading: false, isError: fetchFailed, isDegraded: degraded };
}

export function useTraceData(): TraceDataStatus {
  const q = useQuery({
    queryKey: queryKeys.trace,
    queryFn: loadTrace,
    staleTime: 0,
  });

  if (q.isPending && !q.data) {
    return { lines: [], entries: [], isLoading: true, isError: false, isDegraded: false };
  }

  return q.data ?? { lines: [], entries: [], isLoading: false, isError: true, isDegraded: false };
}
