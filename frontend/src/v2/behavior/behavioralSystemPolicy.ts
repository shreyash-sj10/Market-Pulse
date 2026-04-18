/**
 * Unified behavioral loop: Journal → Profile → Portfolio → Trade Terminal → Journal.
 * Single source of truth for pre-execution policy shown in the decision panel.
 */
import type { JournalLogVm, JournalStructuredSignals, LearningEngineModel } from "../pages/journal/journalIntelligence";
import { deriveJournalStructuredSignals } from "../pages/journal/journalIntelligence";
import { buildProfileBehaviorModel } from "../pages/profile/buildProfileBehaviorModel";

export type PortfolioRiskInput = {
  totalPnlPct: number;
  unrealizedPnLPaise: number;
  realizedPnLPaise: number;
  isDegraded: boolean;
};

export type TradingSystemPolicy = {
  journalSignals: JournalStructuredSignals;
  /** Null when journal window is empty — terminal still applies portfolio + cold-start copy. */
  profile: ReturnType<typeof buildProfileBehaviorModel>;
  behaviorLayer: {
    activeBiasTag: string;
    biasWarning: string;
    scalingBlocked: boolean;
    thesisMinChars: number;
    thesisMandatory: boolean;
    stopLossRequiredOnBuy: true;
    bullets: string[];
  };
  portfolioLayer: {
    defensive: boolean;
    headline: string;
    executionConfidenceNote: string;
  };
  verdictLayer: {
    headline: string;
    detail: string;
  };
  /** Count of CRITICAL journal surfaces — forwarded to execution context. */
  criticalBreaches: number;
};

const BASE_THESIS_MIN = 10;
const STRICT_THESIS_MIN = 44;

function enforcementFromProfile(
  profile: ReturnType<typeof buildProfileBehaviorModel>,
): {
  scalingBlocked: boolean;
  thesisMandatory: boolean;
} {
  const scale = profile.enforcementRows.find((r) => r.key === "scale");
  const thesis = profile.enforcementRows.find((r) => r.key === "thesis");
  return {
    scalingBlocked: scale?.status === "BLOCKED",
    thesisMandatory: thesis?.status === "MANDATORY",
  };
}

export function buildTradingSystemPolicy(
  logs: JournalLogVm[],
  engine: LearningEngineModel,
  portfolio: PortfolioRiskInput,
): TradingSystemPolicy {
  const journalSignals = deriveJournalStructuredSignals(engine, logs);
  const profile = buildProfileBehaviorModel(logs, engine);

  const criticalBreaches = logs.filter((l) => l.severity === "CRITICAL").length;
  const breachRatio = logs.length > 0 ? criticalBreaches / logs.length : 0;
  const totalPnLPaise = portfolio.unrealizedPnLPaise + portfolio.realizedPnLPaise;
  const negativePnl = !portfolio.isDegraded && (portfolio.totalPnlPct < -0.35 || totalPnLPaise < 0);
  const breachHeavy = logs.length >= 4 && (criticalBreaches >= 3 || breachRatio >= 0.18);
  const driftHeavy =
    engine.driftTotal >= 6 && engine.driftViolations / Math.max(1, engine.driftTotal) >= 0.45;

  const defensive = !portfolio.isDegraded && (negativePnl || breachHeavy || driftHeavy);

  const defaultBiasTag =
    journalSignals.bias !== "None surfaced" ? journalSignals.bias.toUpperCase().replace(/\s+/g, "_") : "NEUTRAL";

  if (!profile) {
    const scalingBlocked = false;
    const thesisMinChars = BASE_THESIS_MIN;
    return {
      journalSignals,
      profile: null,
      behaviorLayer: {
        activeBiasTag: defaultBiasTag,
        biasWarning: "Journal cold — no behavioral profile yet. First closes build policy.",
        scalingBlocked,
        thesisMinChars,
        thesisMandatory: false,
        stopLossRequiredOnBuy: true,
        bullets: [
          "Scaling: ALLOWED (no journal lock)",
          `Thesis: minimum ${thesisMinChars} characters`,
          "Stop loss: REQUIRED on buys",
        ],
      },
      portfolioLayer: {
        defensive,
        headline: defensive
          ? "Portfolio risk elevated — conservative execution advised"
          : "Portfolio posture: normal band (insufficient journal link)",
        executionConfidenceNote: defensive
          ? "Reduce size until journal surfaces stabilize."
          : "Establish journal coverage to unlock full behavioral routing.",
      },
      verdictLayer: {
        headline: defensive
          ? "Defensive ticket — prioritize risk bracket over size."
          : "Proceed with standard protocol; journal will bind on next closes.",
        detail: "Post-trade: execution flows to portfolio, then journal on close.",
      },
      criticalBreaches,
    };
  }

  const { scalingBlocked, thesisMandatory } = enforcementFromProfile(profile);
  const thesisMinChars = thesisMandatory ? STRICT_THESIS_MIN : BASE_THESIS_MIN;

  const activeBiasTag = profile.dominantBiasDisplay;
  const biasWarning = `Active bias load: ${activeBiasTag} — align exits before adds.`;

  const bullets = [
    scalingBlocked ? "Scaling: BLOCKED (profile / journal policy)" : "Scaling: ALLOWED",
    thesisMandatory
      ? `Thesis: MANDATORY — minimum ${thesisMinChars} characters`
      : `Thesis: REQUIRED — minimum ${thesisMinChars} characters`,
    "Stop loss: REQUIRED on buys (system)",
  ];

  const portfolioHeadline = defensive
    ? "Portfolio risk elevated — conservative execution advised"
    : "Portfolio posture: within operating band";

  const executionConfidenceNote = breachHeavy
    ? "Repeated journal breaches — dampen conviction on size-ups."
    : negativePnl
      ? "Negative P&L pressure — favor defense and full bracket."
      : driftHeavy
        ? "Decision drift elevated — tighten thesis and invalidation."
        : "No portfolio-level execution throttle.";

  let verdictHeadline = "System clear — execute with standard protocol.";
  if (scalingBlocked && defensive) {
    verdictHeadline = "HOLD escalation — clear journal + portfolio stress before scaling.";
  } else if (scalingBlocked) {
    verdictHeadline = "Scaling locked — single-lot + deep thesis until streak clears.";
  } else if (defensive) {
    verdictHeadline = "Caution lane — reduce size; keep full risk bracket.";
  }

  const verdictDetail = `${profile.systemInterpretation.primaryIssue} · Journal ${journalSignals.severity} · recurrence ×${journalSignals.frequency}${defensive ? " · portfolio defensive" : ""}.`;

  return {
    journalSignals,
    profile,
    behaviorLayer: {
      activeBiasTag,
      biasWarning,
      scalingBlocked,
      thesisMinChars,
      thesisMandatory,
      stopLossRequiredOnBuy: true,
      bullets,
    },
    portfolioLayer: {
      defensive,
      headline: portfolioHeadline,
      executionConfidenceNote,
    },
    verdictLayer: {
      headline: verdictHeadline,
      detail: verdictDetail,
    },
    criticalBreaches,
  };
}
