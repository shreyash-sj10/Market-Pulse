import React, { useState } from "react";
import { TraceList } from "./TraceList";
import { TraceDetail } from "./TraceDetail";
import { useTradeHistory } from "../../hooks/useTrades";
import type { TradeExtended } from "../../contracts/trade";

export const TracePage: React.FC = () => {
  const { data, isLoading, isError, error } = useTradeHistory();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [visibleCount, setVisibleCount] = useState(20);

  if (isLoading) {
    return <div className="trace-loading">Fetching system execution logs...</div>;
  }

  if (isError) {
    return (
      <div className="trace-error">
        <h3>Trace Pipeline Failure</h3>
        <p>{error?.message || "Failed to retrieve system visibility data."}</p>
      </div>
    );
  }

  const trades = (data?.data || []) as TradeExtended[];
  const visibleTrades = trades.slice(0, visibleCount);
  const selectedTrade = trades.find((t) => t.tradeId === selectedId);

  return (
    <div className="trace-page">
      <div className="trace-layout">
        <aside className="trace-sidebar">
          <h2>Execution History</h2>
          <TraceList 
            trades={visibleTrades} 
            selectedId={selectedId} 
            onSelect={setSelectedId} 
          />
          {trades.length > visibleCount && (
            <button 
              className="load-more-btn" 
              onClick={() => setVisibleCount(prev => prev + 20)}
            >
              Load More ({trades.length - visibleCount} remaining)
            </button>
          )}
        </aside>

        <main className="trace-content">
          {selectedTrade ? (
            <TraceDetail trade={selectedTrade} />
          ) : (
            <div className="trace-prompt">
              <h3>System Visibility Layer</h3>
              <p>Select a trade from the history to view its raw system reasoning and execution trace.</p>
            </div>
          )}
        </main>
      </div>
    </div>
  );
};
