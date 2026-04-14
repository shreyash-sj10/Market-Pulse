import React from "react";
import type { MarketQuote } from "../../contracts/market";
import { formatPaise } from "../../utils/format";

interface QuotePanelProps {
  quotes: MarketQuote[];
}

export const QuotePanel: React.FC<QuotePanelProps> = ({ quotes }) => {
  return (
    <div className="quote-panel">
      {quotes.map((q) => (
        <div key={q.symbol} className="quote-item">
          <div className="quote-header">
            <span className="symbol">{q.symbol}</span>
            <span className={`source-badge ${q.source.toLowerCase()}`}>
              {q.source}
            </span>
          </div>
          <div className="price">{formatPaise(q.pricePaise)}</div>
          {q.isFallback && (
            <div className="fallback-warning">
              ⚠️ Price may be stale
            </div>
          )}
        </div>
      ))}
    </div>
  );
};
