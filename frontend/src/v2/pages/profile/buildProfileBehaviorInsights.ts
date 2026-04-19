import type { BehavioralGuidanceModel, LearningEngineModel, JournalLogVm } from "../journal/journalIntelligence";
import type { ProfileBehaviorModel } from "./buildProfileBehaviorModel";
import type { BehaviorPatternSurface } from "./adaptUserProfileEnvelope";

export type ProfileBehaviorInsight = {
  identifiedPattern: string;
  correction: string;
  impact: string;
};

function byConfidence(a: BehaviorPatternSurface, b: BehaviorPatternSurface): number {
  return b.confidence - a.confidence;
}

function insightFromPattern(p: BehaviorPatternSurface): ProfileBehaviorInsight {
  const n = Math.max(0, Math.round(p.count));
  const c = Math.round(p.confidence);

  switch (p.type) {
    case "REVENGE_TRADING":
      return {
        identifiedPattern: `Re-entry pressure after losses — ${n} same-symbol stack(s) inside the revenge window in your closed history.`,
        correction: `Wait for a fresh pre-trade token after a loss-class close; do not re-open the symbol until the cooldown clears.`,
        impact: `Each stacked event tightens scoring and raises BLOCK probability on the next ticket for that line.`,
      };
    case "OVERTRADING":
    case "OVERTRADING_DAILY":
      return {
        identifiedPattern: `Overtrading — session density breached policy (${n} on the scale the engine used for this window).`,
        correction: `Reduce initiations until IST day cadence drops below the burst floor; one primary thesis per session.`,
        impact: `High frequency without edge recovery degrades discipline score and triggers GUIDE friction on size-ups.`,
      };
    case "EARLY_EXIT_PATTERN":
      return {
        identifiedPattern: `Early exits — ${n} closed round-trip(s) tagged EARLY_EXIT in the scan window.`,
        correction: `Define exit reason before entry; if the plan is still valid, removing risk early requires an explicit rule break note.`,
        impact: `Repeated early cuts cap payoff asymmetry and inflate churn without improving downside control.`,
      };
    case "HOLDING_LOSERS":
      return {
        identifiedPattern: `Holding losers longer than winners — ${n} loss leg(s) drove the hold-time asymmetry test.`,
        correction: `Time-stop losers; do not finance patience on red lines with size from green lines in the same session.`,
        impact: `Asymmetry drags realized expectancy and feeds the next revenge / chase sequence.`,
      };
    case "LOSS_CHASING":
      return {
        identifiedPattern: `Loss chasing — ${n} rapid same-symbol adds after an adverse close met the chase detector.`,
        correction: `Flat the symbol for the rest of the session after a loss; re-entry only on a new day with a new plan.`,
        impact: `Chase adds concentrate exposure when emotional load is highest — the system will keep elevating BLOCK weight.`,
      };
    case "FOMO_ENTRY":
      return {
        identifiedPattern: `Late / FOMO entries — ${n} open(s) landed inside the pre-close window used for this check.`,
        correction: `No new risk inside that window unless the plan was written before the impulse window began.`,
        impact: `Late prints increase slippage and reduce RR quality; entry scoring applies a structural penalty.`,
      };
    case "PANIC_EXIT":
      return {
        identifiedPattern: `Panic exits — ${n} close(s) occurred inside the ultra-short hold-time threshold.`,
        correction: `If liquidity forces a scratch, log it; otherwise enforce minimum hold unless stop or thesis invalidates.`,
        impact: `Micro-holds raise noise in the journal and distort recurrence mining on your dominant mistake key.`,
      };
    case "CHASING_PRICE":
      return {
        identifiedPattern: `Chasing price — ${n} entry(ies) exceeded the allowed drift vs the session reference open.`,
        correction: `Bid/ask discipline: if price runs past plan, the trade is void until a new pullback level prints.`,
        impact: `Chasing inflates average entry vs plan and compresses RR; gateway drift checks can still reject the ticket.`,
      };
    default:
      return {
        identifiedPattern: `${p.type.replace(/_/g, " ")} — engine confidence ${c}%, count signal ${n}.`,
        correction: `Open the Journal, attach the corrective bullets your last close already suggested, and execute them verbatim on the next ticket.`,
        impact: `Until the fingerprint frequency drops, pre-trade authority keeps elevated weight on this failure class.`,
      };
  }
}

function insightFromEngine(engine: LearningEngineModel, logs: JournalLogVm[]): ProfileBehaviorInsight | null {
  if (logs.length === 0 || !engine.recurrenceMistakeKey) return null;
  const label = engine.recurrenceLabel?.trim() && engine.recurrenceLabel !== "—" ? engine.recurrenceLabel : "Dominant mistake fingerprint";
  return {
    identifiedPattern: `${label} — repeated on ${engine.recurrenceCount} of ${engine.windowLogCount} logged surfaces.`,
    correction: `Treat the next three tickets as proof window: same fingerprint → size frozen at prior fill until two clean ACT closes land.`,
    impact: `Recurrence severity ${engine.recurrenceSeverity.toUpperCase()} routes additional GUIDE steps on entry and exit.`,
  };
}

function insightFromInterpretation(model: ProfileBehaviorModel): ProfileBehaviorInsight {
  return {
    identifiedPattern: model.systemInterpretation.primaryIssue,
    correction: `Bias track ${model.dominantBiasDisplay}: ${model.dominantBiasExplanation}`,
    impact: model.systemInterpretation.impact,
  };
}

function insightFromGuidance(b: BehavioralGuidanceModel): ProfileBehaviorInsight {
  return {
    identifiedPattern: b.patternInsight.replace(/^Rule:\s*/i, "").trim() || b.patternInsight,
    correction: b.triggerCondition.replace(/^IF\s/i, "When ").replace(/THEN/i, "then"),
    impact: b.performanceImpact.replace(/^Constraint:\s*/i, "").replace(/^Impact:\s*/i, "").trim() || b.performanceImpact,
  };
}

/**
 * Max 3 actionable rows — API patterns first, then journal engine / model layers.
 */
export function buildProfileBehaviorInsights(
  patterns: BehaviorPatternSurface[],
  engine: LearningEngineModel,
  logs: JournalLogVm[],
  model: ProfileBehaviorModel | null,
  behavioral: BehavioralGuidanceModel,
  stats: { winRate: number; totalTrades: number },
): ProfileBehaviorInsight[] {
  const out: ProfileBehaviorInsight[] = [];
  const sorted = [...patterns].sort(byConfidence);

  for (const p of sorted) {
    if (out.length >= 3) break;
    out.push(insightFromPattern(p));
  }

  if (out.length < 3) {
    const eng = insightFromEngine(engine, logs);
    if (eng && !out.some((o) => o.identifiedPattern === eng.identifiedPattern)) {
      out.push(eng);
    }
  }

  if (out.length < 3 && model) {
    const row = insightFromInterpretation(model);
    if (!out.some((o) => o.identifiedPattern === row.identifiedPattern)) {
      out.push(row);
    }
  }

  if (out.length < 3) {
    const g = insightFromGuidance(behavioral);
    if (!out.some((o) => o.identifiedPattern === g.identifiedPattern)) {
      out.push(g);
    }
  }

  if (out.length === 0 && (stats.totalTrades > 0 || logs.length > 0)) {
    out.push({
      identifiedPattern: `Win rate ${stats.winRate.toFixed(1)}% on SELL outcomes across ${stats.totalTrades} ticket(s) — no pattern row crossed promotion thresholds in this pass.`,
      correction: `Log explicit corrections on the next three closes so recurrence can bind to a fingerprint.`,
      impact: `Until a class promotes, enforcement stays on gateway + exchange rules; adaptive scaling locks remain at baseline.`,
    });
  }

  return out.slice(0, 3);
}
