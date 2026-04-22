import type { Decision } from "../../domain/decision/buildDecision";
import type { MarketStock } from "../../hooks/useMarketExplorer";
import type { IntelligenceBias } from "./mapIntelligenceItems";

/** UI labels only — does not change engine output. */
export function decisionUiLabel(action: Decision["action"]): "VALID TRADE" | "WAIT" | "AVOID" {
  if (action === "ACT") return "VALID TRADE";
  if (action === "BLOCK") return "AVOID";
  return "WAIT";
}

export function decisionUiBadgeClass(
  action: Decision["action"],
): "emerald" | "amber" | "rose" {
  if (action === "ACT") return "emerald";
  if (action === "BLOCK") return "rose";
  return "amber";
}

/** Long-only framing: actionable buy vs stand down. */
export function tradeSideUiLabel(trend: MarketStock["trend"]): "BUY" | "NO TRADE" {
  return trend === "BULLISH" ? "BUY" : "NO TRADE";
}

export function trendTapeUiLabel(trend: MarketStock["trend"]): "Uptrend" | "Downtrend" | "Range-bound" {
  if (trend === "BULLISH") return "Uptrend";
  if (trend === "BEARISH") return "Downtrend";
  return "Range-bound";
}

export function newsSentimentUiLabel(bias: IntelligenceBias | "Mixed"): "Uptrend" | "Downtrend" | "Mixed" {
  if (bias === "Bullish") return "Uptrend";
  if (bias === "Bearish") return "Downtrend";
  if (bias === "Neutral") return "Mixed";
  return "Mixed";
}

const DISPLAY_WORD_MAP: [RegExp, string][] = [
  [/\bBullish\b/gi, "Uptrend"],
  [/\bBearish\b/gi, "Downtrend"],
  [/\bbullish\b/g, "uptrend"],
  [/\bbearish\b/g, "downtrend"],
  [/\bBULLISH\b/g, "UPTREND"],
  [/\bBEARISH\b/g, "DOWNTREND"],
];

/** For tape- and model-generated sentences shown to traders (display-only). */
export function softenScannerLanguage(text: string): string {
  let t = text;
  for (const [re, rep] of DISPLAY_WORD_MAP) {
    t = t.replace(re, rep);
  }
  t = t.replace(/^\s*Act:\s*/i, "Valid trade — ");
  t = t.replace(/^\s*Guide:\s*/i, "Wait — ");
  t = t.replace(/^\s*Blocked:\s*/i, "Avoid — ");
  return t;
}

export function oneLineListReason(decision: Decision): string {
  return softenScannerLanguage(decision.reason);
}
