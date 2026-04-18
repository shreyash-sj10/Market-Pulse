import type { TraceLine } from "../../hooks/useTraceData";

export type ProfileTraceOutcome = "EXECUTED" | "GUIDED" | "BLOCKED";

export type ProfileTraceReasonTag = "bias constraint" | "portfolio risk" | "missing input";

export type ProfileTracePreviewItem = {
  id: string;
  action: "BUY" | "SELL" | "—";
  symbol: string;
  outcome: ProfileTraceOutcome;
  reasonTag: ProfileTraceReasonTag;
  /** Short line from server + decision layer */
  detail: string;
};

function extractSymbol(rawSummary: string, text: string): string {
  const s = `${rawSummary} ${text}`;
  let m = s.match(/\bfor\s+([A-Z][A-Z0-9.-]{0,14})\b/i);
  if (m) return m[1].toUpperCase().replace(/\.$/, "");
  m = s.match(/\bliquidation\s+of\s+([A-Z][A-Z0-9.-]{0,14})\b/i);
  if (m) return m[1].toUpperCase().replace(/\.$/, "");
  m = s.match(/\bof\s+([A-Z][A-Z0-9.-]{0,14})\b/i);
  if (m) return m[1].toUpperCase().replace(/\.$/, "");
  m = s.match(/\b([A-Z]{2,14})\.(?:[A-Z]{2,4})\b/);
  if (m) return m[1];
  m = s.match(/\b([A-Z]{2,14})\b/);
  return m ? m[1] : "—";
}

function inferAction(rawSummary: string, sourceType: string): "BUY" | "SELL" | "—" {
  const s = (rawSummary || "").toLowerCase();
  if (/liquidation|position closed|sell|exit short|cover/i.test(s)) return "SELL";
  if (/entry|buy|accumulat|long|established for/i.test(s)) return "BUY";
  if (sourceType === "PLAN") return "BUY";
  if (sourceType === "ANALYSIS") return "SELL";
  return "—";
}

function outcomeFromVerdictAndText(
  verdict: string | undefined,
  text: string,
  decisionAction: string,
): ProfileTraceOutcome {
  const v = (verdict || "").toUpperCase();
  if (/BLOCK|REJECT|DENY|HALT|ABORT/i.test(v) || /\bBLOCK\b/i.test(text)) return "BLOCKED";
  if (
    v === "AUTHORIZED" ||
    v === "CLOSED" ||
    v === "MITIGATED" ||
    v === "COMMITTED" ||
    v === "FILLED" ||
    v === "SUCCESS" ||
    /EXECUTION_COMMITTED|EXECUTED|FILLED/i.test(text)
  ) {
    return "EXECUTED";
  }
  if (decisionAction === "BLOCK" || /\bBLOCK\b/i.test(text)) return "BLOCKED";
  if (decisionAction === "GUIDE") return "GUIDED";
  if (decisionAction === "ACT") return "EXECUTED";
  if (/GUIDE|DEFER|REVIEW|MITIGATED|NEUTRAL|PENDING/i.test(v)) return "GUIDED";
  return "GUIDED";
}

function reasonTagFrom(line: TraceLine, outcome: ProfileTraceOutcome): ProfileTraceReasonTag {
  const blob = `${line.text} ${line.rawSummary ?? ""} ${line.reason}`.toLowerCase();
  if (/missing|required before|incomplete|invalid input|thesis|stop loss|target|quantity|notional.*0/i.test(blob)) {
    return "missing input";
  }
  if (
    /portfolio|holding|balance|exposure|margin|defensive|pnl|drawdown|notional|elevated risk|capital/i.test(blob)
  ) {
    return "portfolio risk";
  }
  if (/bias|behavior|overhold|impulsive|pattern|discipline|constraint|guard|pre-trade|protocol/i.test(blob)) {
    return "bias constraint";
  }
  if (outcome === "BLOCKED") return "bias constraint";
  if (outcome === "GUIDED") return "portfolio risk";
  return "bias constraint";
}

function decisionActionFromSummary(line: TraceLine): string {
  const m = line.decisionSummary?.match(/^([A-Z]+)\s*·/i);
  return m ? m[1].toUpperCase() : "ACT";
}

export function mapTraceLinesToProfilePreview(lines: TraceLine[], max = 5): ProfileTracePreviewItem[] {
  return lines.slice(0, max).map((line) => {
    const rawSummary = line.rawSummary ?? "";
    const sourceType = line.sourceType ?? "UNKNOWN";
    const symbol = extractSymbol(rawSummary, line.text);
    const action = inferAction(rawSummary, sourceType);
    const decisionAction = decisionActionFromSummary(line);
    const outcome = outcomeFromVerdictAndText(line.verdict, line.text, decisionAction);
    const reasonTag = reasonTagFrom(line, outcome);
    const raw = (rawSummary || line.reason || line.text).replace(/\s+/g, " ").trim();
    const detail = raw.length > 120 ? `${raw.slice(0, 118)}…` : raw;

    return {
      id: line.id,
      action,
      symbol,
      outcome,
      reasonTag,
      detail,
    };
  });
}
