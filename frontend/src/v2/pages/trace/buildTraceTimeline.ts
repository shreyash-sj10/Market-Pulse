import type { Decision } from "../../domain/decision/buildDecision";

export type TraceTimelineKind = "EXEC" | "WARN" | "BLOCK" | "INFO";

export type TraceListItemNormalized = {
  id: string;
  type: string;
  timestamp: string;
  verdict: string | null;
  summary: string;
  systemAction: string | null;
  confidence: number | null;
  reason: string;
};

export type TraceTimelineEntry = {
  id: string;
  iso: string;
  timeLabel: string;
  kind: TraceTimelineKind;
  eventSummary: string;
  sourceType: string;
  decision: Decision | null;
  confidence: number | null;
  reason: string;
};

function timelineKind(verdict: string, systemAction: string | null): TraceTimelineKind {
  const a = (systemAction || "").trim().toUpperCase();
  if (a === "BLOCK") return "BLOCK";
  if (a === "GUIDE") return "WARN";
  if (a === "ACT") return "EXEC";
  const v = (verdict || "").toUpperCase();
  if (/BLOCK|REJECT|DENY|HALT|ABORT/.test(v)) return "BLOCK";
  if (/GUIDE|DEFER|REVIEW|PENDING|WARN/.test(v)) return "WARN";
  if (/AUTHORIZED|CLOSED|FILLED|COMMITTED|MITIGATED|SUCCESS/.test(v)) return "EXEC";
  return "INFO";
}

function systemDecision(
  systemAction: string | null,
  confidence: number | null,
  reason: string,
  verdict: string,
  summary: string,
): Decision | null {
  const r = reason.trim() || summary.trim();
  const c = confidence != null && Number.isFinite(confidence) ? Math.min(100, Math.max(0, Math.round(confidence))) : null;
  const a = (systemAction || "").trim().toUpperCase();
  if (a === "ACT" || a === "GUIDE" || a === "BLOCK") {
    return {
      action: a,
      confidence: c ?? (a === "ACT" ? 72 : a === "BLOCK" ? 45 : 58),
      reason: r || "System decision recorded on trace row.",
    };
  }
  const v = (verdict || "").toUpperCase();
  if (/BLOCK|REJECT|DENY|HALT/.test(v)) {
    return { action: "BLOCK", confidence: c ?? 44, reason: r || "Blocked by policy or validation." };
  }
  if (/GUIDE|DEFER|REVIEW|PENDING|NEUTRAL/.test(v)) {
    return { action: "GUIDE", confidence: c ?? 58, reason: r || "Guided path — review before commit." };
  }
  if (/AUTHORIZED|CLOSED|FILLED|COMMITTED|MITIGATED|SUCCESS/.test(v)) {
    return { action: "ACT", confidence: c ?? 74, reason: r || "Authorized execution path." };
  }
  return null;
}

function formatTime(iso: string): string {
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return "—";
  return new Date(t).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

export function buildTraceTimelineEntries(items: TraceListItemNormalized[]): TraceTimelineEntry[] {
  return items.map((item) => {
    const verdict = item.verdict ?? "NEUTRAL";
    const summary = item.summary.trim() || "System event.";
    const reason = item.reason.trim() || summary;
    const kind = timelineKind(verdict, item.systemAction);
    const decision = systemDecision(item.systemAction, item.confidence, reason, verdict, summary);
    return {
      id: item.id,
      iso: item.timestamp,
      timeLabel: formatTime(item.timestamp),
      kind,
      eventSummary: summary,
      sourceType: item.type,
      decision,
      confidence: item.confidence != null && Number.isFinite(item.confidence) ? Math.round(item.confidence) : null,
      reason,
    };
  });
}
