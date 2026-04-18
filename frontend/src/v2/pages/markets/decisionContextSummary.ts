import type { Decision } from "../../domain/decision/buildDecision";
import type { MarketStock } from "../../hooks/useMarketExplorer";
import { scannerSignalFromStock } from "./marketSignals";

function warningsFromTape(stock: MarketStock): string[] {
  const w: string[] = [];
  if (stock.trend === "BEARISH") w.push("Bearish trend");
  if (stock.changePercent < -1.5) w.push("Significant decline");
  return w;
}

/** Volume tier from raw share count — no external AI. */
function volumeTier(volume: number): "high" | "moderate" | "light" {
  if (!Number.isFinite(volume) || volume <= 0) return "light";
  if (volume >= 500_000) return "high";
  if (volume >= 50_000) return "moderate";
  return "light";
}

/**
 * 2–3 lines: momentum / trend / volume composite + risk flags.
 * Must not read like a company profile — only tape + engine posture.
 */
export function buildDecisionContextSummaryLines(decision: Decision, stock: MarketStock): string[] {
  const lines: string[] = [];
  const vt = volumeTier(stock.volume);
  const wf = warningsFromTape(stock);

  if (stock.trend === "BULLISH" && stock.changePercent > 0.5) {
    lines.push(
      vt === "high"
        ? "Bullish momentum with volume confirmation."
        : "Bullish tape; participation is below a full confirmation tier.",
    );
  } else if (stock.trend === "BEARISH" || stock.changePercent < -0.5) {
    lines.push(
      vt === "high"
        ? "Bearish pressure with elevated turnover."
        : "Bearish lean on the tape; liquidity is not yet extreme.",
    );
  } else {
    lines.push(
      vt === "moderate" || vt === "high"
        ? "Sideways regime with measurable turnover."
        : "Sideways regime — range-bound tape and light flow.",
    );
  }

  if (stock.trend === "BULLISH" && stock.changePercent > 0) {
    lines.push("Trend and session change align for continuation bias.");
  } else if (stock.trend === "BEARISH" && stock.changePercent < 0) {
    lines.push("Trend and session change align for defensive bias.");
  } else {
    lines.push("Trend and change are misaligned — edge is unclear.");
  }

  if (stock.isFallback || stock.isSynthetic) {
    lines.push("Quote path is degraded — treat signals as best-effort only.");
  } else if (wf.length > 0) {
    lines.push(`Risk flags: ${wf.join("; ")}.`);
  } else if (decision.action === "BLOCK") {
    lines.push("Rule engine: elevated caution — review constraints before acting.");
  } else {
    lines.push("No immediate risk flags from the rule engine on this tape.");
  }

  return lines.slice(0, 3);
}

/** 1–2 lines; distinct from the context summary — scanner label + engine readout. */
export function buildMarketSignalLines(stock: MarketStock, decision: Decision): string[] {
  const sig = scannerSignalFromStock(stock);
  return [
    `Scanner: ${sig.label} · ${stock.trend} · ${stock.changePercent >= 0 ? "+" : ""}${stock.changePercent.toFixed(2)}%.`,
    `Engine posture: ${decision.action} · ${decision.confidence}% confidence.`,
  ];
}

export function buildSuggestedAction(decision: Decision): string {
  if (decision.action === "ACT") return "Review entry conditions before trade";
  if (decision.action === "BLOCK") return "Avoid trade due to weak confirmation";
  return "Wait for stronger confirmation before sizing exposure.";
}
