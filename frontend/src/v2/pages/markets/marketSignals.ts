import type { MarketStock } from "../../hooks/useMarketExplorer";

export type ScannerSignal = {
  label: string;
  cls: string;
  action: "ACT" | "GUIDE" | "BLOCK";
};

/** Table / tape signal — rule-style labels from trend and session change only. */
export function scannerSignalFromStock(stock: MarketStock): ScannerSignal {
  if (stock.trend === "BULLISH" && stock.changePercent > 1) {
    return { label: "SYSTEMATIC BUY", cls: "scanner-row__signal--act", action: "ACT" };
  }
  if (stock.trend === "BEARISH" || stock.changePercent < -1) {
    return { label: "AVOID", cls: "scanner-row__signal--block", action: "BLOCK" };
  }
  return { label: "NEUTRAL", cls: "scanner-row__signal--guide", action: "GUIDE" };
}
