export type TradeBehaviorTone = "good" | "bad" | "warn";

export type TradePatternKey = "disciplined" | "revenge" | "early_exit" | "panic" | "holding_losers";

export function clampScore(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

export function toneFromLog(action: string, confidence: number, archetype: string): TradeBehaviorTone {
  if (action === "ACT" && confidence >= 72) return "good";
  if (action === "BLOCK" || confidence < 52 || archetype === "IMPULSIVE" || archetype === "OVERHOLD") return "bad";
  return "warn";
}

function inferPatternCore(
  blob: string,
  tone: TradeBehaviorTone,
  archetype: string,
  warnFallback: "disciplined" | "panic",
): TradePatternKey {
  if (tone === "good" || archetype === "STOPPED_OUT") return "disciplined";
  if (/revenge|tilt|after loss|loss streak|double down/i.test(blob)) return "revenge";
  if (/early exit|exited early|booked early|took profit too soon/i.test(blob)) return "early_exit";
  if (/panic|rush|fomo|chase|snap/i.test(blob)) return "panic";
  if (/hold|overhold|ignored exit|past stop|dismissed stop/i.test(blob) || archetype === "OVERHOLD") {
    return "holding_losers";
  }
  return tone === "bad" ? "panic" : warnFallback;
}

/** Journal cards: warn-tone without keyword hits maps to disciplined (legacy behavior). */
export function inferPatternFromJournalBlob(
  blob: string,
  tone: TradeBehaviorTone,
  archetype: string,
): TradePatternKey {
  return inferPatternCore(blob, tone, archetype, "disciplined");
}

/** Weekly / evolution aggregations: warn-tone without keyword hits maps to panic (legacy behavior). */
export function inferPatternFromReportBlob(
  blob: string,
  tone: TradeBehaviorTone,
  archetype: string,
): TradePatternKey {
  return inferPatternCore(blob, tone, archetype, "panic");
}
