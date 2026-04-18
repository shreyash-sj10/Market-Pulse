export type GateChecklistItem = {
  id: string;
  ok: boolean;
  label: string;
};

export type DecisionActionBarProps = {
  phase: "setup" | "review";
  primaryLabel: string;
  canPrimary: boolean;
  onPrimary: () => void;
  onCancel: () => void;
  checklist?: GateChecklistItem[];
};

export default function DecisionActionBar({
  phase,
  primaryLabel,
  canPrimary,
  onPrimary,
  onCancel,
  checklist,
}: DecisionActionBarProps) {
  return (
    <div className="trade-terminal-action-gate">
      {checklist && checklist.length > 0 ? (
        <ul className="trade-terminal-gate-checklist" aria-label="Execution prerequisites">
          {checklist.map((row) => (
            <li
              key={row.id}
              className={row.ok ? "trade-terminal-gate-checklist__row is-ok" : "trade-terminal-gate-checklist__row is-no"}
            >
              <span className="trade-terminal-gate-checklist__mark" aria-hidden>
                {row.ok ? "✓" : "○"}
              </span>
              <span className="trade-terminal-gate-checklist__text">{row.label}</span>
            </li>
          ))}
        </ul>
      ) : null}
      <div className="trade-terminal-actions">
        <button
          type="button"
          className={
            phase === "review"
              ? "trade-terminal-btn trade-terminal-btn--primary trade-terminal-btn--execute"
              : "trade-terminal-btn trade-terminal-btn--primary"
          }
          onClick={onPrimary}
          disabled={!canPrimary}
        >
          {primaryLabel}
        </button>
        <button type="button" className="trade-terminal-btn trade-terminal-btn--secondary" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  );
}
