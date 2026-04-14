import React from "react";
import type { PortfolioSummary as PortfolioSummaryType } from "../../contracts/portfolio";
import { formatPaise, formatPct } from "../../utils/format";

interface PortfolioSummaryProps {
  summary: PortfolioSummaryType;
}

export const PortfolioSummary: React.FC<PortfolioSummaryProps> = ({ summary }) => {
  return (
    <div className="portfolio-summary-card">
      <div className="summary-item">
        <label>Total Value</label>
        <span className="value">{formatPaise(summary.totalValuePaise)}</span>
      </div>
      <div className="summary-item">
        <label>Total PnL %</label>
        <span className={`value ${summary.totalPnlPct >= 0 ? "positive" : "negative"}`}>
          {formatPct(summary.totalPnlPct)}
        </span>
      </div>
      <div className="summary-item">
        <label>Available Balance</label>
        <span className="value">{formatPaise(summary.balancePaise)}</span>
      </div>
    </div>
  );
};
