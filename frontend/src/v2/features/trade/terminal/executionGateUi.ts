import type { Decision } from "../../../domain/decision/buildDecision";
import type { TradingSystemPolicy } from "../../../behavior/behavioralSystemPolicy";
import type { TradeEvaluation } from "./tradeEvaluation";

export type GateVerdict = "ALLOWED" | "GUIDED" | "BLOCKED";

export function setupGateVerdict(
  decision: Decision,
  policy: TradingSystemPolicy,
  localGateBlocked: boolean,
): { verdict: GateVerdict; explanation: string } {
  if (localGateBlocked || decision.action === "BLOCK") {
    const why =
      decision.action === "BLOCK"
        ? decision.reason || "Market signal blocks this ticket."
        : "Inputs fail system checks — stop, thesis, quantity, or scaling policy.";
    return { verdict: "BLOCKED", explanation: why };
  }
  const parts: string[] = [];
  if (policy.portfolioLayer.defensive) {
    parts.push(policy.portfolioLayer.executionConfidenceNote);
  }
  if (policy.behaviorLayer.scalingBlocked) {
    parts.push("Scaling restricted by profile — single-lot until unlock streak.");
  }
  if (decision.action === "GUIDE") {
    parts.push(decision.reason || "Signal in GUIDE band — execution only after risk gate.");
  }
  if (decision.confidence < 58) {
    parts.push("Signal confidence below comfort threshold — full risk review required.");
  }
  if (parts.length > 0) {
    return {
      verdict: "GUIDED",
      explanation: `Execution allowed with constraints due to behavioral drift. ${parts.join(" ")}`.trim(),
    };
  }
  return {
    verdict: "ALLOWED",
    explanation:
      "Execution channel open under current profile, portfolio posture, and market signal.",
  };
}

export function reviewGateVerdict(ev: TradeEvaluation | null): { verdict: GateVerdict; explanation: string } {
  if (!ev) return { verdict: "GUIDED", explanation: "Awaiting risk evaluation." };
  if (ev.status === "BLOCKED") {
    return { verdict: "BLOCKED", explanation: ev.messages[0] ?? "System evaluation blocked this ticket." };
  }
  if (ev.status === "ADJUST") {
    return {
      verdict: "GUIDED",
      explanation: ev.messages[0] ?? "Adjust inputs or acknowledge constraints before submit.",
    };
  }
  const rs = ev.riskScore;
  if (typeof rs === "number" && rs >= 62) {
    return { verdict: "GUIDED", explanation: ev.messages[0] ?? "Elevated risk score — submit only if you accept the bracket." };
  }
  return { verdict: "ALLOWED", explanation: ev.messages[0] ?? "Risk gate passed — order eligible for submit." };
}

export function analyzeButtonLabel(
  localGateBlocked: boolean,
  decision: Decision,
  canEvaluate: boolean,
  policy: TradingSystemPolicy,
): string {
  if (localGateBlocked || decision.action === "BLOCK") return "BLOCKED — FIX INPUTS";
  if (!canEvaluate) return "BLOCKED — FIX INPUTS";
  if (policy.portfolioLayer.defensive || policy.behaviorLayer.scalingBlocked || decision.action === "GUIDE") {
    return "PROCEED UNDER CONSTRAINTS";
  }
  if (decision.confidence < 60) return "RUN RISK GATE (LOW CONFIDENCE)";
  return "RUN SYSTEM RISK GATE";
}

export function executeButtonLabel(
  canExecute: boolean,
  evaluation: TradeEvaluation | null,
  policy: TradingSystemPolicy,
): string {
  if (!canExecute) {
    const msg = evaluation?.messages?.[0] ?? "";
    if (msg.toUpperCase().includes("MARKET_DATA") || msg.toUpperCase().includes("INSUFFICIENT")) {
      return "BLOCKED — INSUFFICIENT MARKET DATA";
    }
    return "BLOCKED — FIX INPUTS";
  }
  const rs = evaluation?.riskScore;
  const softRisk = typeof rs === "number" && rs < 55;
  const constrained =
    policy.portfolioLayer.defensive || policy.behaviorLayer.scalingBlocked || policy.behaviorLayer.thesisMandatory;
  if (constrained) return "EXECUTE WITH CONSTRAINTS";
  if (softRisk) return "EXECUTE (LOW CONFIDENCE)";
  return "SUBMIT ORDER";
}
