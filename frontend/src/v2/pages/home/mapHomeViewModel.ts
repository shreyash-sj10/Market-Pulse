/**
 * Home page view model — all mapping from hooks/API shapes to UI props.
 * No React. No JSX. Safe for tests.
 */
import type { DecisionCardProps } from "../../components/decision/DecisionCard";
import type { PortfolioSummary } from "../../hooks/usePortfolioSummary";
import type { TraceLine } from "../../hooks/useTraceData";
import { formatINR, fromPaise } from "../../../utils/currency.utils.js";

export type SystemStateVM = {
  netEquityDisplay: string;
  unrealizedPnlDisplay: string;
  riskStatusHeadline: string;
  riskStatusSub: string;
};

export type NextActionVariant = "loading" | "first_trade" | "review_attention" | "stable";

export type NextActionVM =
  | { variant: "loading" }
  | {
      variant: "first_trade";
      headline: string;
      sub: string;
      ctaExplore: true;
    }
  | {
      variant: "review_attention";
      headline: string;
      sub: string;
      topItem: DecisionCardProps;
      ctaReview: true;
    }
  | {
      variant: "stable";
      headline: string;
      sub: string;
    };

export type BehaviorInsightVM =
  | { kind: "empty"; message: string }
  | {
      kind: "insight";
      mistake: string;
      correction: string;
    };

export type EventLogEntryVM = {
  id: string;
  time: string;
  type: string;
  message: string;
};

const ACTION_RANK: Record<string, number> = { BLOCK: 3, GUIDE: 2, ACT: 1 };

/** Urgent first: BLOCK > GUIDE > ACT, then higher confidence. */
export function sortAttentionByUrgency(items: DecisionCardProps[]): DecisionCardProps[] {
  return [...items].sort((a, b) => {
    const ra = ACTION_RANK[a.decision.action] ?? 0;
    const rb = ACTION_RANK[b.decision.action] ?? 0;
    if (rb !== ra) return rb - ra;
    return b.decision.confidence - a.decision.confidence;
  });
}

function formatMoneyPaise(paise: number): string {
  if (!Number.isFinite(paise)) return "—";
  return formatINR(Math.round(paise));
}

function signedPaise(paise: number): string {
  if (!Number.isFinite(paise)) return "—";
  if (paise === 0) return formatINR(0);
  const sign = paise > 0 ? "+" : "";
  return sign + formatINR(Math.abs(Math.round(paise)));
}

export function buildSystemState(
  accountSummary: PortfolioSummary | null,
  portfolioLoading: boolean,
  summaryFetchFailed: boolean,
  sortedAttention: DecisionCardProps[],
  positionCount: number,
): SystemStateVM {
  if (portfolioLoading) {
    return {
      netEquityDisplay: "—",
      unrealizedPnlDisplay: "—",
      riskStatusHeadline: "—",
      riskStatusSub: "Loading account…",
    };
  }

  if (summaryFetchFailed || !accountSummary) {
    return {
      netEquityDisplay: "—",
      unrealizedPnlDisplay: "—",
      riskStatusHeadline: "Unavailable",
      riskStatusSub: "Portfolio summary could not be loaded.",
    };
  }

  if (accountSummary.isDegraded) {
    return {
      netEquityDisplay: formatMoneyPaise(accountSummary.netEquityPaise),
      unrealizedPnlDisplay: signedPaise(accountSummary.unrealizedPnLPaise),
      riskStatusHeadline: "Partial data",
      riskStatusSub: "Some live fields may be missing — figures are best-effort.",
    };
  }

  const hasBlock = sortedAttention.some((i) => i.decision.action === "BLOCK");
  const hasGuide = sortedAttention.some((i) => i.decision.action === "GUIDE");

  let riskHead = "Stable";
  let riskSub = "No items in your review queue.";
  if (hasBlock) {
    riskHead = "Action needed";
    riskSub = "At least one holding is in a blocked risk band.";
  } else if (hasGuide) {
    riskHead = "Review suggested";
    riskSub = "Guidance available on one or more holdings.";
  } else if (positionCount === 0) {
    riskHead = "No exposure";
    riskSub = "Open a position to activate portfolio risk signals.";
  }

  return {
    netEquityDisplay: formatMoneyPaise(accountSummary.netEquityPaise),
    unrealizedPnlDisplay: signedPaise(accountSummary.unrealizedPnLPaise),
    riskStatusHeadline: riskHead,
    riskStatusSub: riskSub,
  };
}

export function buildNextAction(
  portfolioLoading: boolean,
  attentionLoading: boolean,
  positionItems: DecisionCardProps[],
  sortedAttention: DecisionCardProps[],
): NextActionVM {
  if (portfolioLoading || attentionLoading) {
    return { variant: "loading" };
  }

  if (positionItems.length === 0) {
    return {
      variant: "first_trade",
      headline: "Start your first trade",
      sub: "You have no open positions. Explore the market scanner to place an order.",
      ctaExplore: true,
    };
  }

  if (sortedAttention.length > 0) {
    const top = sortedAttention[0];
    return {
      variant: "review_attention",
      headline: "Review required",
      sub: `Highest priority: ${top.title} (${top.decision.action}, ${top.decision.confidence}% confidence).`,
      topItem: top,
      ctaReview: true,
    };
  }

  return {
    variant: "stable",
    headline: "System stable — no action required",
    sub: "Your open positions are within the current risk policy. Check back if the market moves sharply.",
  };
}

export function takeAttentionSlice(sorted: DecisionCardProps[], max: number): DecisionCardProps[] {
  return sorted.slice(0, max);
}

export function buildBehaviorInsight(profileItems: DecisionCardProps[]): BehaviorInsightVM {
  const first = profileItems[0];
  if (!first) {
    return { kind: "empty", message: "No behavioral risks detected" };
  }
  const mistake = first.title?.trim() || "";
  const correction =
    (typeof first.meta?.journalInsight === "string" && first.meta.journalInsight.trim()) ||
    first.decision.reason ||
    "";
  if (!mistake && !correction) {
    return { kind: "empty", message: "No behavioral risks detected" };
  }
  return {
    kind: "insight",
    mistake: mistake || "Pattern note",
    correction: correction || "—",
  };
}

function parseTraceLineForDisplay(line: TraceLine): EventLogEntryVM {
  const raw = line.text || "";
  const timeMatch = raw.match(/^\[([^\]]+)\]/);
  const time = timeMatch ? timeMatch[1].split(" ").slice(-1)[0] || timeMatch[1] : "—";
  const rest = raw.replace(/^\[[^\]]+\]\s*/, "").trim();
  const typeMatch = rest.match(/^(INFO|WARN|EXEC|ERR|DECISION|BLOCK|ACT|GUIDE|CHECK)\b/i);
  const rawT = typeMatch ? typeMatch[1].toUpperCase() : "LOG";
  const type = rawT.length <= 8 ? rawT : rawT.slice(0, 8);
  const body = typeMatch ? rest.slice(typeMatch[0].length).trim() : rest;
  const message = body.length > 120 ? `${body.slice(0, 117)}…` : body;
  return { id: line.id, time, type, message: message || raw };
}

export function buildEventLogs(lines: TraceLine[], max: number): EventLogEntryVM[] {
  return lines.slice(0, max).map(parseTraceLineForDisplay);
}

export function formatEntryInr(avgPricePaise: number | undefined): string {
  if (avgPricePaise == null || !Number.isFinite(avgPricePaise) || avgPricePaise <= 0) return "—";
  return `₹${fromPaise(avgPricePaise).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function attentionCtaLabel(action: string): string {
  if (action === "BLOCK") return "Review risk";
  if (action === "GUIDE") return "Review";
  return "View";
}

export function positionStatusFromDecision(action: string): string {
  if (action === "BLOCK") return "At risk";
  if (action === "GUIDE") return "Guided";
  return "OK";
}
