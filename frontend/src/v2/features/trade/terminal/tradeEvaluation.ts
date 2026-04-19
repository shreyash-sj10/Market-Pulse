import type { PreTradeResult } from "../../../api/trade.api";
import { deriveTradeOutcome } from "./tradeOutcome";

export type TradeEvaluationStatus = "VALID" | "ADJUST" | "BLOCKED";

export type TradeEvaluation = {
  status: TradeEvaluationStatus;
  messages: string[];
  riskScore?: number;
};

/** Maps pre-trade API output to a strict frontend gate (no API contract changes). */
export function buildTradeEvaluation(result: PreTradeResult): TradeEvaluation {
  const snap = result?.data?.snapshot;
  const authority = result?.data?.authority;
  const verdict = authority?.verdict ?? null;
  const token = authority?.token;

  if (result.success === false) {
    const msg = typeof result.state === "string" && result.state.trim() ? result.state : "Evaluation failed.";
    return { status: "BLOCKED", messages: [msg] };
  }

  if (!snap || !authority) {
    return {
      status: "BLOCKED",
      messages: ["Evaluation returned incomplete data. Run ANALYZE RISK again."],
    };
  }

  const v = (verdict || "").toUpperCase();
  const riskStatus = (snap.risk?.status || "").toUpperCase();
  const hardBlocked =
    v === "BLOCK" ||
    v === "AVOID" ||
    snap.risk?.verdict === "BLOCK" ||
    snap.risk?.verdict === "AVOID" ||
    riskStatus === "FAIL" ||
    riskStatus === "INVALID" ||
    riskStatus === "UNAVAILABLE" ||
    !token;

  const messages: string[] = [];
  const riskScore = snap.risk?.score;

  if (hardBlocked) {
    messages.push(snap.risk?.reason || "Trade blocked by system evaluation.");
    return { status: "BLOCKED", messages, riskScore };
  }

  const { outcome, message } = deriveTradeOutcome(snap, verdict);
  if (message) messages.push(message);
  for (const f of snap.behavior?.flags ?? []) {
    messages.push(String(f).replace(/_/g, " "));
  }

  if (outcome === "valid") {
    return { status: "VALID", messages, riskScore };
  }
  if (outcome === "blocked") {
    return {
      status: "BLOCKED",
      messages: messages.length ? messages : ["Trade blocked."],
      riskScore,
    };
  }
  return { status: "ADJUST", messages, riskScore };
}
