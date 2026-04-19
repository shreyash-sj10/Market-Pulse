/**
 * Derives learning-engine metrics, system-level guidance, and log view-models
 * from normalized journal rows (no mock rows — empty in → neutral signals).
 */

export type DecisionAction = "ACT" | "GUIDE" | "BLOCK";

export type LogSeverity = "CRITICAL" | "WARNING" | "INFO";

/** Classified from text + tags — drives layout emphasis */
export type JournalArchetype = "STOPPED_OUT" | "OVERHOLD" | "IMPULSIVE" | "DEFAULT";

export type JournalLogVm = {
  id: string;
  symbol: string;
  dateLabel: string;
  /** Mood at opening leg when recorded (self-report). */
  preTradeEmotion?: string | null;
  behaviorTags: ("impulsive" | "systematic")[];
  centerKind: "mistake" | "observation";
  centerPrimary: string;
  behavioralWhy: string;
  correctionBullets: string[];
  confidence: number;
  decisionAction: DecisionAction;
  severity: LogSeverity;
  /** Normalized fingerprint — links engine recurrence to log rows */
  mistakeKey: string;
  archetype: JournalArchetype;
  /** Rows in window sharing this fingerprint (for confidence tooltip) */
  fingerprintMatchCount: number;
};

export type RecurrenceSeverity = "high" | "medium" | "low";

export type LearningEngineModel = {
  recurrenceLabel: string;
  recurrenceCount: number;
  recurrenceSeverity: RecurrenceSeverity;
  /** Normalized key for top recurrence — use to highlight contributing logs */
  recurrenceMistakeKey: string | null;
  biasLabel: string;
  /** Logs whose text matches the surfaced bias rule */
  biasContributingLogCount: number;
  driftViolations: number;
  driftTotal: number;
  correctionRatePct: number | null;
  /** Logs with ≥2 protocol bullets */
  correctionReadyLogCount: number;
  windowLogCount: number;
};

/** Structured journal outputs consumed by Profile + Trade Terminal policy. */
export type JournalStructuredSignals = {
  bias: string;
  severity: RecurrenceSeverity;
  /** Mean log confidence in window; null when no logs. */
  confidence: number | null;
  /** Recurrence count of dominant fingerprint (pattern frequency). */
  frequency: number;
};

export function deriveJournalStructuredSignals(
  engine: LearningEngineModel,
  logs: JournalLogVm[],
): JournalStructuredSignals {
  const confidence =
    logs.length === 0
      ? null
      : Math.round(logs.reduce((s, l) => s + (Number.isFinite(l.confidence) ? l.confidence : 0), 0) / logs.length);
  return {
    bias: engine.biasLabel?.trim() && engine.biasLabel !== "—" ? engine.biasLabel : "None surfaced",
    severity: engine.recurrenceSeverity,
    confidence,
    frequency: engine.recurrenceCount,
  };
}

export type BehavioralGuidanceModel = {
  patternInsight: string;
  systemAction: string;
  patternConfidencePct: number | null;
  triggerCondition: string;
  performanceImpact: string;
};

export type EngineLinkFocus = "recurrence" | "bias" | "drift" | "correction" | null;

const BIAS_RULES: { label: string; test: (blob: string) => boolean }[] = [
  { label: "FOMO", test: (b) => /fomo|chase|chasing|late entry|momentum|panic buy/i.test(b) },
  { label: "Revenge", test: (b) => /revenge|after loss|loss streak|double down|tilt/i.test(b) },
  { label: "Overhold", test: (b) => /overhold|held too long|ignored exit|past stop|dismissed stop/i.test(b) },
];

type WindowKind = "neg_impulsive" | "neg_cluster" | "drift" | "default";

export function normalizeMistakeKey(mistake: string): string {
  return mistake
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[^a-z0-9 ]/g, "")
    .trim()
    .slice(0, 96);
}

export function correctionToBullets(correction: string): string[] {
  const raw = correction.trim();
  if (!raw) return [];
  const byNl = raw
    .split(/\n+/)
    .map((s) => s.trim())
    .filter(Boolean);
  if (byNl.length > 1) return byNl.slice(0, 8);
  const byDelim = raw
    .split(/(?:\.\s+|;(?=\s)|•)\s*/)
    .map((s) => s.replace(/^•\s*/, "").trim())
    .filter(Boolean);
  const out = byDelim.length > 1 ? byDelim : [raw];
  return out.slice(0, 8).map((s) => (s.endsWith(".") ? s : `${s}.`));
}

export function deriveLogSeverity(action: DecisionAction, confidence: number): LogSeverity {
  const c = Number.isFinite(confidence) ? confidence : 0;
  if (action === "BLOCK" || c < 46) return "CRITICAL";
  if (action === "GUIDE" || (action === "ACT" && c < 70)) return "WARNING";
  return "INFO";
}

/** Amber strip + WARNING badge only when deviation or high-severity recurrence hits this fingerprint */
export function shouldSurfaceWarningPill(log: JournalLogVm, engine: LearningEngineModel): boolean {
  if (log.severity !== "WARNING") return false;
  const highRec =
    engine.recurrenceSeverity === "high" &&
    engine.recurrenceMistakeKey != null &&
    log.mistakeKey === engine.recurrenceMistakeKey;
  /** Surface only on material deviation (avoid routine GUIDE/ACT rows) */
  const deviation =
    log.decisionAction === "GUIDE"
      ? log.confidence < 58
      : log.decisionAction === "ACT" && log.confidence < 52;
  return highRec || deviation;
}

/** Left strip: red = critical deviation, amber = warning, green = correct behavior, none = omit bar */
export type AccentTone = "critical" | "warning" | "positive" | "none";

export function visualAccent(log: JournalLogVm, engine: LearningEngineModel): AccentTone {
  if (log.severity === "CRITICAL") return "critical";
  if (log.severity === "WARNING" && shouldSurfaceWarningPill(log, engine)) return "warning";
  if (log.archetype === "STOPPED_OUT") return "positive";
  return "none";
}

export function severityBadgeToShow(
  log: JournalLogVm,
  engine: LearningEngineModel,
): LogSeverity | null {
  if (log.severity === "CRITICAL") return "CRITICAL";
  if (shouldSurfaceWarningPill(log, engine)) return "WARNING";
  return null;
}

export type ConfidenceReadout = "LOW" | "MEDIUM" | "HIGH";

export function confidenceReadoutLabel(pct: number): ConfidenceReadout {
  if (pct >= 78) return "HIGH";
  if (pct >= 58) return "MEDIUM";
  return "LOW";
}

export function confidenceRingTooltip(pct: number, matchingEntries: number): string {
  const n = Math.max(1, matchingEntries);
  const derived = `Derived from ${n} matching logs.`;
  if (pct >= 78) return `${derived} HIGH: gates bind.`;
  if (pct >= 58) return `${derived} MEDIUM: confirm risk before sizing.`;
  return `${derived} LOW: protocol advisory until rescored.`;
}

/** Primary behavior type label (row header) */
export function primaryBehaviorType(log: JournalLogVm): string {
  if (log.archetype === "STOPPED_OUT") return "STOPPED OUT";
  if (log.archetype === "OVERHOLD") return "OVERHOLD";
  if (log.archetype === "IMPULSIVE") return "IMPULSIVE";
  return log.centerKind === "mistake" ? "MISTAKE" : "OBSERVATION";
}

/** Secondary tag line — avoids duplicating IMPULSIVE when archetype already states it */
export function secondaryTagLine(log: JournalLogVm): string | null {
  const tags = log.behaviorTags.map((t) => t.toUpperCase());
  if (log.archetype === "IMPULSIVE") {
    const rest = tags.filter((t) => t !== "IMPULSIVE");
    return rest.length > 0 ? rest.join(" · ") : null;
  }
  if (tags.length === 0) return null;
  return tags.join(" · ");
}

export function classifyJournalArchetype(
  centerPrimary: string,
  behavioralWhy: string,
  correctionBullets: string[],
  behaviorTags: ("impulsive" | "systematic")[],
): JournalArchetype {
  const blob = `${centerPrimary} ${behavioralWhy} ${correctionBullets.join(" ")}`.toLowerCase();
  if (
    /stop.?out|stopped out|hit stop|stop loss|stop honoured|honor stop|honour stop|discipline exit|rule exit|cut at plan/i.test(
      blob,
    )
  ) {
    return "STOPPED_OUT";
  }
  if (/overhold|held too long|ignored exit|past stop|dismissed stop|ignored the exit/i.test(blob)) {
    return "OVERHOLD";
  }
  if (
    /impulsive|fomo|revenge|chase|timing|late entry|panic|rush|snap/i.test(blob) ||
    (behaviorTags.includes("impulsive") && !behaviorTags.includes("systematic"))
  ) {
    return "IMPULSIVE";
  }
  return "DEFAULT";
}

export function enrichJournalLogs(logs: JournalLogVm[]): JournalLogVm[] {
  const counts = new Map<string, number>();
  for (const l of logs) {
    counts.set(l.mistakeKey, (counts.get(l.mistakeKey) ?? 0) + 1);
  }
  return logs.map((l) => ({
    ...l,
    fingerprintMatchCount: counts.get(l.mistakeKey) ?? 1,
  }));
}

function deriveBehaviorTags(
  apiTags: string[],
  riskScore: number,
  action: DecisionAction,
): ("impulsive" | "systematic")[] {
  const blob = apiTags.join(" ");
  const lower = blob.toLowerCase();
  const tags = new Set<"impulsive" | "systematic">();
  if (/impuls|fomo|revenge|chase|panic|rush|tilt|snap/i.test(lower)) tags.add("impulsive");
  if (/system|plan|checklist|process|discipline|routine|ruleset|playbook/i.test(lower)) tags.add("systematic");
  if (tags.size === 0) {
    if (action === "BLOCK" || riskScore < 58) tags.add("impulsive");
    else if (action === "ACT" && riskScore >= 72) tags.add("systematic");
    else {
      tags.add("impulsive");
      tags.add("systematic");
    }
  }
  return [...tags];
}

function severityFrom(count: number, total: number): RecurrenceSeverity {
  if (total <= 0) return "low";
  const ratio = count / total;
  if (count >= 4 && ratio >= 0.35) return "high";
  if (count >= 2 && ratio >= 0.2) return "medium";
  return "low";
}

function dominantBias(logs: JournalLogVm[]): string {
  const blob = logs
    .map((l) => `${l.centerPrimary} ${l.behavioralWhy}`)
    .join(" ")
    .slice(0, 4000);
  for (const r of BIAS_RULES) {
    if (r.test(blob)) return r.label;
  }
  return "None surfaced";
}

export function countLogsMatchingBias(logs: JournalLogVm[], biasLabel: string): number {
  const rule = BIAS_RULES.find((r) => r.label === biasLabel);
  if (!rule) return 0;
  return logs.filter((l) => rule.test(`${l.centerPrimary} ${l.behavioralWhy}`)).length;
}

export function logMatchesEngineLink(
  log: JournalLogVm,
  link: Exclude<EngineLinkFocus, null>,
  engine: LearningEngineModel,
): boolean {
  if (link === "recurrence") {
    return Boolean(engine.recurrenceMistakeKey && log.mistakeKey === engine.recurrenceMistakeKey);
  }
  if (link === "bias") {
    return engine.biasLabel !== "None surfaced" && countLogsMatchingBias([log], engine.biasLabel) === 1;
  }
  if (link === "drift") {
    return log.decisionAction !== "ACT";
  }
  if (link === "correction") {
    return log.correctionBullets.length >= 2;
  }
  return false;
}

function analyzeWindow(logs: JournalLogVm[]): {
  kind: WindowKind;
  patternInsight: string;
  triggerCondition: string;
  performanceImpact: string;
} {
  if (logs.length === 0) {
    return {
      kind: "default",
      patternInsight: "Rule: no journal window — engine holds default gates until surfaces exist.",
      triggerCondition: "IF journal.entries = 0 THEN suppress pattern outputs.",
      performanceImpact: "Impact: none — no behavioral constraint from this layer.",
    };
  }
  const recent = logs.slice(0, 6);
  const neg = recent.filter(
    (l) =>
      /loss|breach|violation|blocked|below|drawdown|adverse/i.test(`${l.centerPrimary} ${l.behavioralWhy}`),
  ).length;
  const impulsiveStreak = recent.filter(
    (l) => l.behaviorTags.includes("impulsive") && !l.behaviorTags.includes("systematic"),
  ).length;
  if (neg >= 3 && impulsiveStreak >= 2) {
    return {
      kind: "neg_impulsive",
      patternInsight:
        "Rule: treat recency as hostile — adverse stack plus impulsive-only tags forces throttle, not narrative.",
      triggerCondition: "IF adverse_count ≥ 3 in last(6) AND impulsive_only ≥ 2 THEN elevate enforcement tier.",
      performanceImpact: "Constraint: high — next tickets carry elevated sequencing and sizing caps.",
    };
  }
  if (neg >= 3) {
    return {
      kind: "neg_cluster",
      patternInsight:
        "Rule: adverse cluster in window — freeze size-up until cadence is re-proven on two clean closes.",
      triggerCondition: "IF adverse_count ≥ 3 in last(6) THEN require cadence review before add-risk.",
      performanceImpact: "Constraint: medium — aggression capped until dispersion normalizes.",
    };
  }
  const driftHeavy = recent.filter((l) => l.decisionAction !== "ACT").length;
  if (driftHeavy >= 4) {
    return {
      kind: "drift",
      patternInsight:
        "Rule: non-ACT dominance in window — assume policy drift; default to stricter pre-trade checks.",
      triggerCondition: "IF non_ACT_count ≥ 4 in last(6) THEN enforce stricter pre-trade checklist.",
      performanceImpact: "Constraint: medium — expect elevated GUIDE/BLOCK friction until posture clears.",
    };
  }
  const top = recent[0];
  return {
    kind: "default",
    patternInsight: `Rule: single-row signal (${top.symbol}) — carry forward only as watch condition until recurrence confirms.`,
    triggerCondition: "IF window_consensus = false THEN treat insight as non-binding except for symbol watch.",
    performanceImpact: "Constraint: low — no portfolio-wide throttle from this readout alone.",
  };
}

function patternConfidenceFrom(
  logs: JournalLogVm[],
  engine: LearningEngineModel,
  kind: WindowKind,
): number {
  if (logs.length === 0) return 0;
  const recRatio = engine.recurrenceCount / logs.length;
  const driftRatio = engine.driftViolations / logs.length;
  let base = 44 + recRatio * 36 + (engine.biasLabel !== "None surfaced" ? 14 : 0);
  if (kind === "neg_impulsive") base += 7;
  if (kind === "neg_cluster") base += 4;
  if (kind === "drift") base += 2;
  if (kind === "default") base -= 9;
  base -= driftRatio * 14;
  if (engine.correctionRatePct != null && engine.correctionRatePct < 35) base -= 5;
  return Math.round(Math.min(95, Math.max(30, base)));
}

function systemActionFrom(logs: JournalLogVm[], bias: string, recurrence: string): string {
  if (logs.length === 0) {
    return "MANDATORY: hold default risk gates. No journal override until entries exist.";
  }
  if (bias === "Revenge") {
    return "MANDATORY: session lock after 3 consecutive loss-tagged closes; unlock only from Profile.";
  }
  if (bias === "FOMO") {
    return "MANDATORY: block market orders 30m after any GUIDE/BLOCK journal row until checklist ack.";
  }
  if (bias === "Overhold") {
    return "MANDATORY: restate exit plan on ticket before any add-size on lines tagged with hold drift.";
  }
  if (/slip|mistake/i.test(recurrence) && logs.filter((l) => l.decisionAction === "BLOCK").length >= 2) {
    return "MANDATORY: cut max line size 25% until two ACT-tagged closes with no repeat fingerprint.";
  }
  return "MANDATORY: written protocol ack on next ticket whenever journal emits GUIDE or BLOCK.";
}

export function deriveLearningEngine(logs: JournalLogVm[]): LearningEngineModel {
  if (logs.length === 0) {
    return {
      recurrenceLabel: "—",
      recurrenceCount: 0,
      recurrenceSeverity: "low",
      recurrenceMistakeKey: null,
      biasLabel: "—",
      biasContributingLogCount: 0,
      driftViolations: 0,
      driftTotal: 0,
      correctionRatePct: null,
      correctionReadyLogCount: 0,
      windowLogCount: 0,
    };
  }
  const counts = new Map<string, { key: string; label: string; n: number }>();
  for (const l of logs) {
    const key = l.mistakeKey || normalizeMistakeKey(l.centerPrimary) || "unspecified";
    const cur = counts.get(key);
    if (cur) cur.n += 1;
    else counts.set(key, { key, label: l.centerPrimary.slice(0, 72), n: 1 });
  }
  let best = { label: logs[0].centerPrimary.slice(0, 72), n: 0, key: "" as string };
  for (const v of counts.values()) {
    if (v.n > best.n) best = { label: v.label, n: v.n, key: v.key };
  }
  const driftTotal = logs.length;
  const driftViolations = logs.filter((l) => l.decisionAction !== "ACT").length;
  const actionable = logs.filter((l) => l.correctionBullets.length >= 2).length;
  const correctionRatePct = Math.round((actionable / driftTotal) * 100);
  const biasLabel = dominantBias(logs);
  const biasContributingLogCount = countLogsMatchingBias(logs, biasLabel);

  return {
    recurrenceLabel: best.n > 0 ? best.label : "—",
    recurrenceCount: best.n,
    recurrenceSeverity: severityFrom(best.n, driftTotal),
    recurrenceMistakeKey: best.n > 0 ? best.key : null,
    biasLabel,
    biasContributingLogCount,
    driftViolations,
    driftTotal,
    correctionRatePct,
    correctionReadyLogCount: actionable,
    windowLogCount: driftTotal,
  };
}

export function deriveBehavioralGuidance(logs: JournalLogVm[]): BehavioralGuidanceModel {
  const engine = deriveLearningEngine(logs);
  const win = analyzeWindow(logs);
  const action = systemActionFrom(logs, engine.biasLabel, engine.recurrenceLabel);
  const patternConfidencePct =
    logs.length === 0 ? null : patternConfidenceFrom(logs, engine, win.kind);
  return {
    patternInsight: win.patternInsight,
    systemAction: action,
    patternConfidencePct,
    triggerCondition: win.triggerCondition,
    performanceImpact: win.performanceImpact,
  };
}

export type JournalRowSource = {
  symbol: string;
  sortTime: number;
  dateLabel: string;
  preTradeEmotion?: string | null;
  mistake: string;
  correction: string;
  insight: string;
  verdict: string;
  tagList: string[];
  confidence: number;
  allowed: boolean;
  riskScore: number;
  warnings: boolean | string[];
  isObservation: boolean;
  decision: { action: DecisionAction; confidence: number; reason: string };
};

export function journalRowToLogVm(row: JournalRowSource): JournalLogVm {
  const decisionAction = row.decision.action;
  const confidence = Number.isFinite(row.decision.confidence)
    ? Math.min(100, Math.max(0, Math.round(row.decision.confidence)))
    : 0;
  const centerKind: "mistake" | "observation" = row.isObservation ? "observation" : "mistake";
  const centerPrimary =
    centerKind === "observation"
      ? (row.verdict || row.insight || row.mistake || row.symbol).trim() || "Observation"
      : (row.mistake || row.symbol).trim() || "Mistake";
  const behavioralWhy =
    (row.insight && row.insight !== "—" ? row.insight : "").trim() ||
    row.decision.reason ||
    "No causal layer recorded — backfill insight on the trade ticket.";
  const correctionBullets = correctionToBullets(row.correction);
  const behaviorTags = deriveBehaviorTags(row.tagList, row.riskScore, decisionAction);
  const mistakeKey = normalizeMistakeKey(centerPrimary) || "unspecified";
  const severity = deriveLogSeverity(decisionAction, confidence);
  const archetype = classifyJournalArchetype(centerPrimary, behavioralWhy, correctionBullets, behaviorTags);

  return {
    id: `${row.symbol || "?"}-${row.sortTime}`,
    symbol: row.symbol || "—",
    dateLabel: row.dateLabel,
    preTradeEmotion: row.preTradeEmotion ?? null,
    behaviorTags,
    centerKind,
    centerPrimary,
    behavioralWhy,
    correctionBullets,
    confidence,
    decisionAction,
    severity,
    mistakeKey,
    archetype,
    fingerprintMatchCount: 1,
  };
}
