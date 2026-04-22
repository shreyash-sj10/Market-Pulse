/**
 * Composes mandatory home data hooks only.
 * Account summary for system metrics is folded into usePortfolioDecisions (parallel GET).
 * All UI mapping delegated to mapHomeViewModel — not in components.
 */
import { useMemo } from "react";
import { useAttentionDecisions } from "../../hooks/useAttentionDecisions";
import { usePortfolioDecisions } from "../portfolio/usePortfolioDecisions";
import { useProfileDecisions } from "../../hooks/useProfileDecisions";
import { useTraceData } from "../../hooks/useTraceData";
import {
  buildSystemState,
  buildSystemStatus,
  buildNextAction,
  buildBehaviorInsight,
  buildEventLogs,
  sortAttentionByUrgency,
  takeAttentionSlice,
  type SystemStateVM,
  type SystemStatusVM,
  type NextActionVM,
  type BehaviorInsightVM,
  type EventLogEntryVM,
} from "./mapHomeViewModel";
import type { DecisionCardProps } from "../../components/decision/DecisionCard";

export type HomeViewModel = {
  systemStatus: SystemStatusVM;
  systemState: SystemStateVM;
  nextAction: NextActionVM;
  attentionTop3: DecisionCardProps[];
  /** Full sorted attention (for next-action top item); same source as attentionTop3 */
  sortedAttention: DecisionCardProps[];
  positions: DecisionCardProps[];
  behaviorInsight: BehaviorInsightVM;
  eventLogs: EventLogEntryVM[];
  loading: {
    portfolio: boolean;
    attention: boolean;
    profile: boolean;
    trace: boolean;
  };
  errors: {
    portfolio: boolean;
    attention: boolean;
    profile: boolean;
    trace: boolean;
    summary: boolean;
  };
};

export function useHomeViewModel(): HomeViewModel {
  const attention = useAttentionDecisions();
  const portfolio = usePortfolioDecisions();
  const profile   = useProfileDecisions();
  const trace     = useTraceData();

  return useMemo(() => {
    const sortedAttention = sortAttentionByUrgency(attention.items);
    const attentionTop3   = takeAttentionSlice(sortedAttention, 3);
    const positionCount   = portfolio.items.length;

    const systemState = buildSystemState(
      portfolio.accountSummary ?? null,
      portfolio.isLoading,
      Boolean(portfolio.summaryFetchFailed),
      sortedAttention,
      positionCount,
    );
    const hasAnyError =
      portfolio.isError ||
      attention.isError ||
      profile.isError ||
      trace.isError ||
      Boolean(portfolio.summaryFetchFailed);
    const systemStatus = buildSystemStatus(
      portfolio.isLoading,
      attention.isLoading,
      hasAnyError,
      sortedAttention,
    );

    const nextAction = buildNextAction(
      portfolio.isLoading,
      attention.isLoading,
      portfolio.items,
      sortedAttention,
      profile.items,
    );

    const behaviorInsight = buildBehaviorInsight(profile.items);
    const eventLogs       = buildEventLogs(trace.lines, 8);

    return {
      systemStatus,
      systemState,
      nextAction,
      attentionTop3,
      sortedAttention,
      positions: portfolio.items,
      behaviorInsight,
      eventLogs,
      loading: {
        portfolio: portfolio.isLoading,
        attention: attention.isLoading,
        profile:   profile.isLoading,
        trace:     trace.isLoading,
      },
      errors: {
        portfolio: portfolio.isError,
        attention: attention.isError,
        profile:   profile.isError,
        trace:     trace.isError,
        summary:   Boolean(portfolio.summaryFetchFailed),
      },
    };
  }, [
    attention.items,
    attention.isLoading,
    attention.isError,
    portfolio.items,
    portfolio.isLoading,
    portfolio.isError,
    portfolio.accountSummary,
    portfolio.summaryFetchFailed,
    profile.items,
    profile.isLoading,
    profile.isError,
    trace.lines,
    trace.isLoading,
    trace.isError,
  ]);
}
