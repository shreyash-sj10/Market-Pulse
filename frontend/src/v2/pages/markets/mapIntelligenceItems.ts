import type { NewsSignal } from "../../hooks/useMarketNews";

export type IntelligenceBias = "Bullish" | "Bearish" | "Neutral";

export type IntelligenceItem = {
  id: string;
  headline: string;
  impact: string;
  bias: IntelligenceBias;
};

function clampLine(s: string, max: number): string {
  const t = s.replace(/\s+/g, " ").trim();
  if (!t) return "";
  return t.length <= max ? t : `${t.slice(0, max - 1).trim()}…`;
}

function biasFromSignal(sig: NewsSignal): IntelligenceBias {
  const v = String(sig.verdict ?? "").toUpperCase();
  if (v === "BUY" || v === "BULLISH" || v === "OUTPERFORM" || v === "OVERWEIGHT") return "Bullish";
  if (v === "SELL" || v === "BEARISH" || v === "UNDERPERFORM" || v === "UNDERWEIGHT") return "Bearish";
  return "Neutral";
}

/**
 * Maps API news signals to at most `max` compact intelligence rows — no raw feed dump.
 */
export function mapSignalsToIntelligenceItems(signals: NewsSignal[], max = 3): IntelligenceItem[] {
  const slice = signals.slice(0, max);
  return slice.map((sig, i) => {
    const headline = clampLine(sig.event || "Signal", 96);
    const rawImpact = (typeof sig.impact === "string" && sig.impact.trim()) || sig.judgment || "";
    let impact = clampLine(rawImpact, 140);
    if (!impact) {
      impact = clampLine([sig.sector, sig.verdict].filter(Boolean).join(" · "), 140);
    }
    return {
      id: `${i}-${headline.slice(0, 24)}`,
      headline: headline || "Signal",
      impact: impact || "—",
      bias: biasFromSignal(sig),
    };
  });
}
