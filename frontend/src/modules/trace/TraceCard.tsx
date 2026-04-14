import React from "react";
import type { TradeExtended } from "../../contracts/trade";
import { formatPct } from "../../utils/format";

interface TraceCardProps {
  trade: TradeExtended;
  onClick: () => void;
  isActive: boolean;
}

export const TraceCard: React.FC<TraceCardProps> = ({ trade, onClick, isActive }) => {
  return (
    <div 
      className={`trace-card ${isActive ? "active" : ""}`} 
      onClick={onClick}
    >
      <div className="card-header">
        <span className="symbol">{trade.symbol}</span>
        <span className={`side ${trade.side?.toLowerCase()}`}>{trade.side}</span>
      </div>
      <div className="card-body">
        <span className="pnl">Result: {formatPct(trade.pnlPct)}</span>
        <span className="status">Status: {trade.status}</span>
      </div>
    </div>
  );
};
