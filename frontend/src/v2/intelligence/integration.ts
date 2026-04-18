/** Curated signal copy only — no raw model output. */

import type { Decision } from "../domain/decision/buildDecision";

/** True when AI / news intelligence is missing or explicitly unavailable (no fabricated output). */
export function isAiInsightsUnavailable(ai: unknown): boolean {
  if (ai == null) return true;
  if (typeof ai !== "object") return true;
  const r = ai as Record<string, unknown>;
  if (r.status === "UNAVAILABLE") return true;
  if (r.success === false) return true;
  const data = r.data;
  if (data && typeof data === "object") {
    const d = data as Record<string, unknown>;
    if (d.status === "UNAVAILABLE") return true;
  }
  return false;
}

export type RailState = "ok" | "warn" | "degraded";

export function getHomeAlerts(): string[] {
  return ["Review GUIDE items before sizing up.", "Resolve BLOCK states before new entries."];
}

export function getMarketSignalTag(symbol: string): string | null {
  const tags: Record<string, string> = {
    NIFTY: "bench",
    BANKNIFTY: "vol",
    RELIANCE: "flow",
    SBIN: "liquidity",
  };
  return tags[symbol] ?? null;
}

export function getPortfolioInsight(): string {
  return "Last week: more GUIDE than ACT — tighten confirmation before execute.";
}

export function getDecisionRailState(decisions: Decision[]): { state: RailState; message: string } {
  const blocks = decisions.filter((d) => d.action === "BLOCK").length;
  const guides = decisions.filter((d) => d.action === "GUIDE").length;
  if (blocks > 0) {
    return { state: "degraded", message: `BLOCK ${blocks}` };
  }
  if (guides > 0) {
    return { state: "warn", message: `GUIDE ${guides}` };
  }
  return { state: "ok", message: `BLOCK ${blocks} · GUIDE ${guides}` };
}

export function getBehaviorInsight(): string {
  return "Behavior: confirm intent on GUIDE; skip execute on BLOCK.";
}
