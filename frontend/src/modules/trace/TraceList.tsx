import React from "react";
import { TraceCard } from "./TraceCard";
import type { TradeExtended } from "../../contracts/trade";

interface TraceListProps {
  trades: TradeExtended[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

export const TraceList: React.FC<TraceListProps> = ({ trades, selectedId, onSelect }) => {
  if (trades.length === 0) {
    return (
      <div className="trace-empty">
        <p>NO TRACE DATA AVAILABLE</p>
      </div>
    );
  }

  return (
    <div className="trace-list">
      {trades.map((trade) => (
        <TraceCard 
          key={trade.tradeId} 
          trade={trade} 
          isActive={selectedId === trade.tradeId}
          onClick={() => trade.tradeId && onSelect(trade.tradeId)}
        />
      ))}
    </div>
  );
};
