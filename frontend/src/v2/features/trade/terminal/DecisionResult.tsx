export type TradeOutcomeVisual = "pending" | "valid" | "adjust" | "blocked";

export type DecisionResultProps = {
  outcome: TradeOutcomeVisual;
  message?: string;
};

export default function DecisionResult({ outcome, message }: DecisionResultProps) {
  let state = "";
  let detail: string | undefined = message;

  if (outcome === "pending") {
    state = "Complete inputs → run Analyze Risk";
    detail = message ?? "System has not evaluated this ticket yet.";
  } else if (outcome === "valid") {
    state = "Ready to submit";
    detail = message ?? "Execution is permitted when you confirm.";
  } else if (outcome === "adjust") {
    state = "Adjust inputs";
    detail = message ?? "Fix the items below before running the risk gate again.";
  } else {
    state = "Gate closed";
    detail = message ?? "Execution is not permitted under current constraints.";
  }

  return (
    <div className={`trade-terminal-judgment trade-terminal-judgment--${outcome}`}>
      <p className="trade-terminal-judgment__kicker">Risk gate</p>
      <p className="trade-terminal-judgment__state">{state}</p>
      {detail ? <p className="trade-terminal-judgment__detail">{detail}</p> : null}
    </div>
  );
}
