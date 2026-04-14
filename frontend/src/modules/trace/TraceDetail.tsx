import React from "react";
import type { TradeExtended } from "../../contracts/trade";
import { formatPaise } from "../../utils/format";

interface TraceDetailProps {
  trade: TradeExtended;
}

export const TraceDetail: React.FC<TraceDetailProps> = ({ trade }) => {
  const { decisionSnapshot, trace, ai } = trade;

  return (
    <div className="trace-detail">
      <section className="section">
        <h3>1. Decision Snapshot</h3>
        {decisionSnapshot ? (
          <div className="snapshot-grid">
            <div className="item">
              <label>System Verdict</label>
              <span>{decisionSnapshot.verdict || "Not Available"}</span>
            </div>
            <div className="item">
              <label>Risk Score</label>
              <span>{decisionSnapshot.score ?? "Not Available"}</span>
            </div>
            <div className="item">
              <label>Behavior Signals</label>
              <span>{JSON.stringify(decisionSnapshot.pillars?.behavior) || "Not Available"}</span>
            </div>
            <div className="item">
              <label>Warnings</label>
              <span>{decisionSnapshot.warnings?.join(", ") || "None"}</span>
            </div>
          </div>
        ) : (
          <p>Not Available</p>
        )}
      </section>

      <section className="section">
        <h3>2. Execution Data</h3>
        <div className="execution-grid">
          <div className="item">
            <label>Price</label>
            <span>{formatPaise(trade.pricePaise)}</span>
          </div>
          <div className="item">
            <label>Quantity</label>
            <span>{trade.quantity}</span>
          </div>
        </div>
      </section>

      <section className="section">
        <h3>3. System Trace Logs</h3>
        {trace?.timeline && trace.timeline.length > 0 ? (
          <div className="trace-timeline">
            {trace.timeline.map((step, i) => (
              <div key={i} className="trace-step">
                <div className="step-header">
                  <span className="stage">{step.stage}</span>
                  <span className="time">{new Date(step.timestamp).toLocaleTimeString()}</span>
                </div>
                <pre className="raw-metadata">
                  {JSON.stringify(step.metadata, null, 2)}
                </pre>
              </div>
            ))}
          </div>
        ) : (
          <p>Not Available</p>
        )}
      </section>

      {ai && (
        <section className="section">
          <h3>4. AI Explanation</h3>
          {ai.status === "OK" ? (
            <div className="ai-explanation">
              <p className="summary">{ai.explanation.summary}</p>
              {ai.explanation.warnings.length > 0 && (
                <div className="warnings">
                  <strong>Warnings:</strong> {ai.explanation.warnings.join(", ")}
                </div>
              )}
              {ai.explanation.keyFactors.length > 0 && (
                <div className="factors">
                  <strong>Key Factors:</strong> {ai.explanation.keyFactors.join(", ")}
                </div>
              )}
            </div>
          ) : (
            <p>Analysis unavailable</p>
          )}
        </section>
      )}
    </div>
  );
};
