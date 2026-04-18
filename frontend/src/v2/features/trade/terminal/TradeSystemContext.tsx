import type { Decision } from "../../../domain/decision/buildDecision";
import type { TradingSystemPolicy } from "../../../behavior/behavioralSystemPolicy";

export type TradeSystemContextProps = {
  policy: TradingSystemPolicy;
  decision: Decision;
  breachPositionCount: number;
  stressedPositionCount: number;
  openPositionCount: number;
};

export default function TradeSystemContext({
  policy,
  decision,
  breachPositionCount,
  stressedPositionCount,
  openPositionCount,
}: TradeSystemContextProps) {
  const biasLine = policy.behaviorLayer.scalingBlocked
    ? `${policy.behaviorLayer.activeBiasTag} bias active — scaling restricted`
    : `${policy.behaviorLayer.activeBiasTag} bias — profile monitoring active (scaling permitted)`;

  let portfolioLine: string;
  if (breachPositionCount > 0) {
    portfolioLine = `${breachPositionCount} open position(s) in system breach — defensive posture`;
  } else if (stressedPositionCount > 0) {
    portfolioLine = `${stressedPositionCount} position(s) under drawdown stress — defensive sizing`;
  } else if (policy.portfolioLayer.defensive) {
    portfolioLine = policy.portfolioLayer.headline;
  } else if (openPositionCount > 0) {
    portfolioLine = `${openPositionCount} open line(s) — posture within band`;
  } else {
    portfolioLine = "No open lines — flat book";
  }

  const signalLine = `Signal confidence: ${decision.confidence}% (${decision.action})`;

  return (
    <section className="trade-terminal-sys-context" aria-label="System context">
      <p className="trade-terminal-sys-context__line">
        <span className="trade-terminal-sys-context__k">Behavior</span>
        {biasLine}
      </p>
      <p className="trade-terminal-sys-context__line">
        <span className="trade-terminal-sys-context__k">Portfolio</span>
        {portfolioLine}
      </p>
      <p className="trade-terminal-sys-context__line">
        <span className="trade-terminal-sys-context__k">Market</span>
        {signalLine}
      </p>
    </section>
  );
}
