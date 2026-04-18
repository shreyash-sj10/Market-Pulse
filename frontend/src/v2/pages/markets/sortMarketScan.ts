import type { MarketStock } from "../../hooks/useMarketExplorer";
import { buildDecision } from "../../domain/decision/buildDecision";
import { buildMarketRowFromExplorerStock } from "../../hooks/useMarketDecisions";

export type MarketDecisionAction = "ACT" | "GUIDE" | "BLOCK";

/** Row-level posture for scanner emphasis (same engine as sort order). */
export function marketStockDecisionAction(stock: MarketStock): MarketDecisionAction {
  const row = buildMarketRowFromExplorerStock(stock);
  return buildDecision(row).action;
}

function actionPriority(action: "ACT" | "GUIDE" | "BLOCK"): number {
  if (action === "ACT") return 3;
  if (action === "GUIDE") return 2;
  return 1;
}

/** Rule-engine decision for scan ordering (same pipeline as useMarketDecisions). */
export function marketStockDecisionRank(stock: MarketStock): { priority: number; confidence: number } {
  const row = buildMarketRowFromExplorerStock(stock);
  const decision = buildDecision(row);
  return { priority: actionPriority(decision.action), confidence: decision.confidence };
}

/**
 * Mandatory scan order: ACT → GUIDE → BLOCK, then confidence descending.
 */
export function sortMarketScanFeed(stocks: MarketStock[]): MarketStock[] {
  return [...stocks].sort((a, b) => {
    const da = marketStockDecisionRank(a);
    const db = marketStockDecisionRank(b);
    if (db.priority !== da.priority) return db.priority - da.priority;
    return db.confidence - da.confidence;
  });
}
