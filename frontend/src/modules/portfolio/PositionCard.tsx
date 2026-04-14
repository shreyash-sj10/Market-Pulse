import React from "react";
import type { PortfolioPosition } from "../../contracts/portfolio";
import { formatPaise, formatPct } from "../../utils/format";

interface PositionCardProps {
  position: PortfolioPosition;
}

export const PositionCard: React.FC<PositionCardProps> = ({ position }) => {
  return (
    <div className="position-card">
      <div className="pos-header">
        <span className="symbol">{position.symbol}</span>
        <span className={`pnl ${position.pnlPct >= 0 ? "positive" : "negative"}`}>
          {formatPct(position.pnlPct)}
        </span>
      </div>
      <div className="pos-body">
        <div className="stat">
          <label>Quantity</label>
          <span>{position.quantity}</span>
        </div>
        <div className="stat">
          <label>Avg Price</label>
          <span>{formatPaise(position.avgPricePaise)}</span>
        </div>
        <div className="stat">
          <label>Current Price</label>
          <span>{formatPaise(position.currentPricePaise)}</span>
        </div>
      </div>
    </div>
  );
};
