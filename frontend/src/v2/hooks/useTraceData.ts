/**
 * Trace lines: log text enriched with buildDecision() for a light explanation layer.
 * No mock data. Empty trace → empty lines.
 */
import { useQuery } from "@tanstack/react-query";
import api from "../api/api.js";
import { queryKeys } from "../queryKeys";
import { normalizeTraceList } from "../adapters/trace.adapter.js";
import { buildDecision } from "../domain/decision/buildDecision";
import type { BuildDecisionInput } from "../domain/decision/buildDecision";

export type TraceLine = {
  id:              string;
  text:            string;
  decisionSummary: string;
  reason:          string;
  /** API trace row: PLAN | TRADE | ANALYSIS */
  sourceType?:     string;
  /** Server humanSummary.verdict */
  verdict?:        string;
  /** Raw decisionSummary from /trace list */
  rawSummary?:     string;
};

export type TraceDataStatus = {
  lines:      TraceLine[];
  isLoading:  boolean;
  isError:    boolean;
  isDegraded: boolean;
};

function logToDecisionInput(text: string): BuildDecisionInput {
  const m = text.match(/confidence[=:]\s*(\d+)/i);
  const n = m ? Number(m[1]) : NaN;
  const riskScore = Number.isFinite(n) ? Math.min(100, Math.max(0, Math.round(n))) : 50;
  if (/\bBLOCK\b/i.test(text)) return { allowed: false, riskScore,               warnings: false };
  if (/\bACT\b/i.test(text))   return { allowed: true,  riskScore: Math.max(70, riskScore), warnings: false };
  if (/\bGUIDE\b/i.test(text)) return { allowed: true,  riskScore: Math.min(69, Math.max(50, riskScore)), warnings: true };
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

function toRawLines(
  raw: ReturnType<typeof normalizeTraceList>,
): { id: string; text: string; sourceType: string; verdict: string; rawSummary: string }[] {
  return raw.map((item) => ({
    id: String(item.id || item.timestamp),
    text: `[${item.timestamp}] ${item.type} ${item.summary || ""}`.trim(),
    sourceType: String(item.type ?? "UNKNOWN"),
    verdict: String(item.verdict ?? "NEUTRAL"),
    rawSummary: String(item.summary ?? ""),
  }));
}

export type TraceFetchResult = {
  lines:       TraceLine[];
  degraded:    boolean;
  fetchFailed: boolean;
};

export async function fetchTraceLines(): Promise<TraceFetchResult> {
  try {
    const response = await api.get("/trace");
    const list = normalizeTraceList(response?.data);
    const sorted = [...list].sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
    );
    return {
      lines: toRawLines(sorted).map((r) => enrichTraceLine(r.id, r.text, {
        sourceType: r.sourceType,
        verdict: r.verdict,
        rawSummary: r.rawSummary,
      })),
      degraded:    false,
      fetchFailed: false,
    };
  } catch {
    return { lines: [], degraded: true, fetchFailed: true };
  }
}

async function loadTrace(): Promise<TraceDataStatus> {
  const { lines, degraded, fetchFailed } = await fetchTraceLines();
  return { lines, isLoading: false, isError: fetchFailed, isDegraded: degraded };
}

export function useTraceData(): TraceDataStatus {
  const q = useQuery({
    queryKey: queryKeys.trace,
    queryFn:  loadTrace,
    staleTime: 0,
  });

  if (q.isPending && !q.data) {
    return { lines: [], isLoading: true, isError: false, isDegraded: false };
  }

  return q.data ?? { lines: [], isLoading: false, isError: true, isDegraded: false };
}
