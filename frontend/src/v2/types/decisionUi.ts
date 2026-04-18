import type { DecisionCardProps } from "../components/decision/DecisionCard";
import type { PortfolioSummary } from "../hooks/usePortfolioSummary";

export type DecisionDataSource = "api" | "fallback";

export type DecisionListStatus = {
  items: DecisionCardProps[];
  /** Real API response path vs local/mock fallback */
  source: DecisionDataSource;
  isLoading: boolean;
  isError: boolean;
  isDegraded: boolean;
  /** Set by usePortfolioDecisions — GET /portfolio/summary alongside positions */
  accountSummary?: PortfolioSummary | null;
  /** True when summary request failed (positions may still be valid) */
  summaryFetchFailed?: boolean;
};

export const noop = (): void => {};
