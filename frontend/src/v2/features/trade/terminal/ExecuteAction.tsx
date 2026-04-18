export type ExecuteActionProps = {
  phase: "setup" | "review";
  canAnalyze: boolean;
  canExecute: boolean;
  executeLabel?: string;
  onAnalyze: () => void;
  onExecute: () => void;
  onCancel: () => void;
  onRevise?: () => void;
};

export default function ExecuteAction({
  phase,
  canAnalyze,
  canExecute,
  executeLabel = "Execute trade",
  onAnalyze,
  onExecute,
  onCancel,
  onRevise,
}: ExecuteActionProps) {
  if (phase === "review") {
    return (
      <div className="trade-terminal-actions">
        <button
          type="button"
          className="trade-terminal-btn trade-terminal-btn--primary trade-terminal-btn--execute"
          onClick={onExecute}
          disabled={!canExecute}
        >
          {executeLabel}
        </button>
        {onRevise ? (
          <button type="button" className="trade-terminal-btn trade-terminal-btn--ghost" onClick={onRevise}>
            Revise inputs
          </button>
        ) : null}
        <button type="button" className="trade-terminal-btn trade-terminal-btn--secondary" onClick={onCancel}>
          Cancel
        </button>
      </div>
    );
  }

  return (
    <div className="trade-terminal-actions">
      <button
        type="button"
        className="trade-terminal-btn trade-terminal-btn--primary"
        onClick={onAnalyze}
        disabled={!canAnalyze}
      >
        Analyze risk
      </button>
      <button type="button" className="trade-terminal-btn trade-terminal-btn--secondary" onClick={onCancel}>
        Cancel
      </button>
    </div>
  );
}
