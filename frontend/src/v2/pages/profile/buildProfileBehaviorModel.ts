/**
 * Trader behavioral identity derived from journal logs + engine (no fabricated rows).
 */
import type { JournalLogVm, LearningEngineModel } from "../journal/journalIntelligence";

export type DisciplineBand = "LOW" | "MEDIUM" | "HIGH";

export type ProfileTendency = { count: number; total: number };

export type EnforcementRow = {
  key: string;
  control: string;
  status: string;
  engaged: boolean;
};

export type ProfileBehaviorScores = {
  /** 0–100: protocol density + stop adherence − impulsive drag */
  executionPrecision: number;
  /** 0–100: ACT share + low drift */
  riskDiscipline: number;
  /** 0–100: inverse bias / hold / impulse pressure */
  biasControl: number;
};

export type SystemInterpretation = {
  primaryIssue: string;
  secondaryIssue: string;
  impact: string;
};

export type ConstraintFeedback = {
  scalingLine: string;
  unlockLine: string;
};

export type BiasShellTone = "hold" | "impulse" | "stop" | "neutral";

export type ProfileBehaviorModel = {
  derivedFromTrades: number;
  dominantBiasDisplay: string;
  dominantBiasExplanation: string;
  /** Archetype winner from logs (used for shell tone + feedback copy). */
  archetypeDominant: string;
  biasShellTone: BiasShellTone;
  behaviorSummary: string;
  executionDiscipline: DisciplineBand;
  riskAdherence: DisciplineBand;
  behaviorScores: ProfileBehaviorScores;
  systemInterpretation: SystemInterpretation;
  constraintFeedback: ConstraintFeedback;
  tendencies: {
    holdsBeyondTarget: ProfileTendency;
    stopsRespected: ProfileTendency;
    impulsiveEntries: ProfileTendency;
  };
  enforcementRows: EnforcementRow[];
};

function bandFromScore(score: number): DisciplineBand {
  if (score >= 68) return "HIGH";
  if (score >= 42) return "MEDIUM";
  return "LOW";
}

function formatBiasLabel(raw: string): string {
  const t = raw.trim();
  if (!t || t === "—" || t === "None surfaced") return "";
  return t.replace(/\s+/g, "_").toUpperCase();
}

function dominantFromArchetypes(logs: JournalLogVm[]): string {
  let o = 0;
  let i = 0;
  let s = 0;
  for (const l of logs) {
    if (l.archetype === "OVERHOLD") o += 1;
    else if (l.archetype === "IMPULSIVE") i += 1;
    else if (l.archetype === "STOPPED_OUT") s += 1;
  }
  if (o === 0 && i === 0 && s === 0) return "MIXED";
  if (o >= i && o >= s) return "OVERHOLD";
  if (i >= o && i >= s) return "IMPULSIVE";
  return "STOPPED_OUT";
}

function dominantBiasExplanationLine(dominant: string): string {
  switch (dominant) {
    case "OVERHOLD":
      return "You frequently hold beyond planned exits.";
    case "IMPULSIVE":
      return "Entries skew toward timing pressure and reactive sequencing.";
    case "STOPPED_OUT":
      return "You frequently honor planned exits when risk crystallizes.";
    case "FOMO":
      return "Conviction tends to arrive late — after the move is obvious.";
    case "REVENGE":
      return "Losses tend to be followed by aggressive re-entry pressure.";
    case "MIXED":
      return "Competing signals — no single failure mode owns this window.";
    default:
      return "Pattern is diffuse — tighten journaling on the next closes.";
  }
}

function disciplineWord(b: DisciplineBand): string {
  if (b === "HIGH") return "strong";
  if (b === "MEDIUM") return "moderate";
  return "limited";
}

function buildBehaviorSummary(
  dominant: string,
  executionDiscipline: DisciplineBand,
  riskAdherence: DisciplineBand,
  holdsBeyond: number,
  impulsive: number,
  total: number,
  stopsRespected: number,
): string {
  const dw = disciplineWord(executionDiscipline);
  const holdRatio = total > 0 ? holdsBeyond / total : 0;
  const impRatio = total > 0 ? impulsive / total : 0;
  const stopRatio = total > 0 ? stopsRespected / total : 0;

  if (dominant === "OVERHOLD" && holdRatio >= 0.12) {
    return `You show ${dw} execution discipline but frequently extend holds past planned exits in this journal window.`;
  }
  if (dominant === "IMPULSIVE" && impRatio >= 0.18) {
    return `You show ${dw} execution discipline with a sustained impulsive-entry footprint in logged closes.`;
  }
  if (dominant === "STOPPED_OUT" && stopRatio >= 0.2) {
    return `You show ${dw} execution discipline and repeatedly respect stop discipline when the journal marks a stop-out.`;
  }
  if (riskAdherence === "LOW") {
    return `You show ${dw} execution discipline; risk posture in the journal reads soft — tighten gates before scaling.`;
  }
  if (riskAdherence === "HIGH" && executionDiscipline === "HIGH") {
    return `You show strong execution discipline and risk adherence on this window — maintain the current protocol cadence.`;
  }
  return `You show ${dw} execution discipline with ${riskAdherence.toLowerCase()} risk adherence across ${total} logged surfaces.`;
}

function clampPct(n: number): number {
  return Math.min(100, Math.max(0, Math.round(n)));
}

type ScoreDim = "exec" | "risk" | "bias";

function pickWeakestDimension(scores: ProfileBehaviorScores): ScoreDim {
  const { executionPrecision: e, riskDiscipline: r, biasControl: b } = scores;
  const order: ScoreDim[] = ["risk", "bias", "exec"];
  let best: ScoreDim = "risk";
  let bestScore = r;
  for (const dim of order) {
    const s = dim === "risk" ? r : dim === "bias" ? b : e;
    if (s < bestScore) {
      bestScore = s;
      best = dim;
    }
  }
  return best;
}

function primaryIssueForDim(dim: ScoreDim, score: number): string {
  if (score >= 74) return "No acute subsystem breach on this window";
  if (score >= 54) {
    if (dim === "risk") return "Moderate risk discipline gaps";
    if (dim === "bias") return "Moderate bias containment stress";
    return "Moderate execution variance";
  }
  if (dim === "risk") return "Low risk discipline";
  if (dim === "bias") return "Low bias control";
  return "Low execution precision";
}

function secondaryIssueLine(dominantDisplay: string, archetypeDominant: string): string {
  if (dominantDisplay === "MIXED" || archetypeDominant === "MIXED") {
    return "No single bias lock — archetype churn";
  }
  const d = dominantDisplay || archetypeDominant;
  return `Bias persistence (${d})`;
}

function impactFor(dim: ScoreDim, dominantDisplay: string, archetypeDominant: string): string {
  const over =
    archetypeDominant === "OVERHOLD" ||
    /OVERHOLD/i.test(dominantDisplay) ||
    /overhold/i.test(dominantDisplay);
  if (over || dim === "bias") {
    return "Reduced capital efficiency and delayed exits.";
  }
  if (dim === "risk") {
    return "Sizing and gate timing degrade — exposure can stack before intent clears.";
  }
  return "Slippage between stated protocol and logged closes.";
}

function biasShellToneFrom(
  dominantDisplay: string,
  archetypeDominant: string,
): BiasShellTone {
  const a = archetypeDominant;
  if (a === "OVERHOLD" || /OVERHOLD/i.test(dominantDisplay)) return "hold";
  if (a === "IMPULSIVE" || /IMPULSIVE/i.test(dominantDisplay)) return "impulse";
  if (a === "STOPPED_OUT" || /STOPPED/i.test(dominantDisplay)) return "stop";
  return "neutral";
}

const COMPLIANT_UNLOCK_COUNT = 3;

function buildConstraintFeedback(
  scalingBlocked: boolean,
  dominantDisplay: string,
  archetypeDominant: string,
): ConstraintFeedback {
  const tag =
    scalingBlocked && archetypeDominant === "OVERHOLD"
      ? "OVERHOLD"
      : scalingBlocked && archetypeDominant === "IMPULSIVE"
        ? "IMPULSIVE"
        : dominantDisplay || archetypeDominant;

  const scalingLine = scalingBlocked
    ? `Scaling disabled due to ${tag} bias.`
    : `Scaling permitted — ${tag} load inside policy envelope.`;

  const unlockLine = scalingBlocked
    ? `Unlock condition: ${COMPLIANT_UNLOCK_COUNT} compliant trades.`
    : `Escalation buffer: ${COMPLIANT_UNLOCK_COUNT} consecutive divergences would re-lock scaling.`;

  return { scalingLine, unlockLine };
}

export function buildProfileBehaviorModel(
  logs: JournalLogVm[],
  engine: LearningEngineModel,
): ProfileBehaviorModel | null {
  if (logs.length === 0) return null;

  const total = logs.length;
  const holdsBeyond = logs.filter((l) => l.archetype === "OVERHOLD").length;
  const stopsRespected = logs.filter((l) => l.archetype === "STOPPED_OUT").length;
  const impulsive = logs.filter((l) => l.archetype === "IMPULSIVE").length;

  const biasFormatted = formatBiasLabel(engine.biasLabel);
  const archetypeDominant = dominantFromArchetypes(logs);
  const dominantBiasDisplay = biasFormatted || archetypeDominant;

  const dominantBiasExplanation = dominantBiasExplanationLine(
    biasFormatted || archetypeDominant,
  );

  const corr = engine.correctionRatePct ?? 0;
  const stoppedRatio = stopsRespected / total;
  const impulsiveRatio = impulsive / total;
  const disciplineScore = Math.round(
    corr * 0.38 + stoppedRatio * 100 * 0.34 + (1 - impulsiveRatio) * 100 * 0.28,
  );
  const executionDiscipline = bandFromScore(disciplineScore);

  const actCount = logs.filter((l) => l.decisionAction === "ACT").length;
  const actRatio = actCount / total;
  const driftRatio = engine.driftTotal > 0 ? engine.driftViolations / engine.driftTotal : 0;
  const riskScore = Math.round(actRatio * 52 + (1 - driftRatio) * 48);
  const riskAdherence = bandFromScore(riskScore);

  const holdRatio = holdsBeyond / total;
  const biasControl = clampPct(
    100 -
      impulsiveRatio * 48 -
      holdRatio * 38 -
      (biasFormatted ? 10 : 0) -
      (engine.driftViolations / Math.max(1, total)) * 14,
  );

  const behaviorScores: ProfileBehaviorScores = {
    executionPrecision: clampPct(disciplineScore),
    riskDiscipline: clampPct(riskScore),
    biasControl,
  };

  const behaviorSummary = buildBehaviorSummary(
    dominantBiasDisplay,
    executionDiscipline,
    riskAdherence,
    holdsBeyond,
    impulsive,
    total,
    stopsRespected,
  );

  const overholdSignal =
    holdsBeyond > 0 || engine.biasLabel === "Overhold" || /overhold/i.test(engine.recurrenceLabel);
  const thesisEngaged = engine.biasLabel === "FOMO" || impulsive / total >= 0.22;

  const scalingBlocked = overholdSignal;

  const enforcementRows: EnforcementRow[] = [
    {
      key: "scale",
      control: "Scaling",
      status: scalingBlocked ? "BLOCKED" : "ALLOWED",
      engaged: scalingBlocked,
    },
    {
      key: "stop",
      control: "Stop Loss",
      status: "REQUIRED",
      engaged: true,
    },
    {
      key: "thesis",
      control: "Thesis",
      status: thesisEngaged ? "MANDATORY" : "OPTIONAL",
      engaged: thesisEngaged,
    },
  ];

  const weakest = pickWeakestDimension(behaviorScores);
  const weakestScore =
    weakest === "risk"
      ? behaviorScores.riskDiscipline
      : weakest === "bias"
        ? behaviorScores.biasControl
        : behaviorScores.executionPrecision;

  const systemInterpretation: SystemInterpretation = {
    primaryIssue: primaryIssueForDim(weakest, weakestScore),
    secondaryIssue: secondaryIssueLine(dominantBiasDisplay, archetypeDominant),
    impact:
      weakestScore >= 74
        ? "Maintain cadence — routing stays efficient while this envelope holds."
        : impactFor(weakest, dominantBiasDisplay, archetypeDominant),
  };

  const constraintFeedback = buildConstraintFeedback(
    scalingBlocked,
    dominantBiasDisplay,
    archetypeDominant,
  );

  const biasShellTone = biasShellToneFrom(dominantBiasDisplay, archetypeDominant);

  return {
    derivedFromTrades: total,
    dominantBiasDisplay,
    dominantBiasExplanation,
    archetypeDominant,
    biasShellTone,
    behaviorSummary,
    executionDiscipline,
    riskAdherence,
    behaviorScores,
    systemInterpretation,
    constraintFeedback,
    tendencies: {
      holdsBeyondTarget: { count: holdsBeyond, total },
      stopsRespected: { count: stopsRespected, total },
      impulsiveEntries: { count: impulsive, total },
    },
    enforcementRows,
  };
}
