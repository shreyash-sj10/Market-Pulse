import RiskValidator, { type RiskValidatorProps } from "./RiskValidator";
import DecisionResult, { type TradeOutcomeVisual } from "./DecisionResult";

export type ValidationEngineViewProps = RiskValidatorProps & {
  outcome: TradeOutcomeVisual;
  message?: string;
};

export default function ValidationEngineView({
  outcome,
  message,
  ...riskProps
}: ValidationEngineViewProps) {
  const effectiveMessage =
    message ||
    (outcome === "pending" ? "Run ANALYZE RISK after inputs pass the checklist." : undefined);

  return (
    <section className="trade-terminal-section">
      <DecisionResult outcome={outcome} message={effectiveMessage} />
      <p className="trade-terminal-kicker trade-terminal-check-heading">SYSTEM CHECK</p>
      <RiskValidator {...riskProps} />
    </section>
  );
}
