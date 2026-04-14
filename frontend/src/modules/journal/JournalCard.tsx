import React from "react";
import type { LearningSurface } from "../../contracts/journal";

interface JournalCardProps {
  symbol: string;
  learning: LearningSurface;
}

export const JournalCard: React.FC<JournalCardProps> = ({ symbol, learning }) => {
  const { verdict, primaryMistake, insight, correction, confidence, tags } = learning;

  return (
    <div className={`journal-card verdict-${verdict.toLowerCase()}`}>
      <div className="card-header">
        <span className="symbol">{symbol}</span>
        <span className="verdict-label">{verdict}</span>
      </div>

      <div className="mistake-section">
        <label>Primary Mistake</label>
        <div className="value">{primaryMistake}</div>
      </div>

      <div className="insight-section">
        <label>Insight</label>
        <p className="value">{insight}</p>
      </div>

      <div className="correction-section">
        <label>Correction</label>
        <p className="value">{correction}</p>
      </div>

      <div className="card-footer">
        <div className="confidence">
          Confidence: {confidence}%
        </div>
        <div className="tags">
          {tags.map((tag, i) => (
            <span key={i} className="tag">
              {tag}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
};
