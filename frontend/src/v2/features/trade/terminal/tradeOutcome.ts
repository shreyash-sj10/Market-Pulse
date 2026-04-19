import type { PreTradeResult } from "../../../api/trade.api";
import type { TradeOutcomeVisual } from "./DecisionResult";

type Snap = PreTradeResult["data"]["snapshot"] | null;

export function deriveTradeOutcome(
  snapshot: Snap,
  authorityVerdict: string | null,
): { outcome: TradeOutcomeVisual; message: string } {
  if (!snapshot || !authorityVerdict) {
    return { outcome: "pending", message: "" };
  }

  const v = authorityVerdict.toUpperCase();
  const flags = snapshot.behavior?.flags ?? [];
  const risk = snapshot.risk;
  const riskStatus = (risk?.status ?? "").toUpperCase();

  if (v === "BLOCK" || v === "AVOID" || risk?.verdict === "BLOCK" || risk?.verdict === "AVOID" || riskStatus === "FAIL" || riskStatus === "INVALID" || riskStatus === "UNAVAILABLE") {
    return {
      outcome: "blocked",
      message:
        risk?.reason ??
        "Engine blocked this plan. Adjust price, size, risk bracket, or thesis, then evaluate again.",
    };
  }

  if (v === "BUY" || v === "SELL") {
    if (flags.length > 0 || (risk?.score != null && risk.score < 55)) {
      return {
        outcome: "adjust",
        message:
          risk?.reason ??
          "Executable, but flags or a softer risk score suggest tightening the plan or reducing size before sending.",
      };
    }
    return {
      outcome: "valid",
      message: risk?.reason ?? "Plan clears discipline checks. Confirm intent, then execute.",
    };
  }

  return {
    outcome: "adjust",
    message:
      risk?.reason ??
      `Authority: ${authorityVerdict}. Refine the plan or wait for a cleaner signal before executing.`,
  };
}
