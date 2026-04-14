import React from "react";
import type { PreTradeResponse } from "../../contracts/preTrade";

interface TradeReviewProps {
  reviewData: PreTradeResponse;
}

export const TradeReview: React.FC<TradeReviewProps> = ({ reviewData }) => {
  const { allowed, snapshot, ai } = reviewData;

  return (
    <div className="trade-review">
      <h3>System Review</h3>
      
      <div className={`verdict ${allowed ? "allowed" : "blocked"}`}>
        <strong>Decision:</strong> {allowed ? "AUTHORIZED" : "BLOCKED"}
      </div>

      <div className="snapshot-section">
        <h4>Risk Analysis</h4>
        <div className="score">Score: {snapshot.riskScore}</div>
        
        {snapshot.warnings.length > 0 && (
          <div className="warnings">
            <h5>Warnings</h5>
            <ul>
              {snapshot.warnings.map((w, i) => (
                <li key={i}>{w}</li>
              ))}
            </ul>
          </div>
        )}

        {snapshot.signals.length > 0 && (
          <div className="signals">
            <h5>Intelligence Signals</h5>
            <ul>
              {snapshot.signals.map((s, i) => (
                <li key={i}>{s}</li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <div className="ai-section">
        <h4>AI Assistant</h4>
        {ai.status === "OK" ? (
          <>
            <p className="summary">{ai.explanation.summary}</p>
            {ai.explanation.warnings.length > 0 && (
              <div className="ai-warnings">
                <strong>Attention:</strong>
                <ul>
                  {ai.explanation.warnings.map((w, i) => (
                    <li key={i}>{w}</li>
                  ))}
                </ul>
              </div>
            )}
            {ai.explanation.keyFactors.length > 0 && (
              <div className="ai-factors">
                <strong>Key Factors:</strong>
                <ul>
                  {ai.explanation.keyFactors.map((f, i) => (
                    <li key={i}>{f}</li>
                  ))}
                </ul>
              </div>
            )}
          </>
        ) : (
          <p className="unavailable">AI unavailable</p>
        )}
      </div>
    </div>
  );
};
