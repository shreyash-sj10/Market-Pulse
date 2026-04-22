import RiskValidator, { type RiskValidatorProps } from "./RiskValidator";
import type { TradeOutcomeVisual } from "./DecisionResult";

export type ReadinessStatus = "valid" | "missing" | "blocked";

export type ReadinessRow = {
  id: string;
  status: ReadinessStatus;
  label: string;
};

function Mark({ status }: { status: ReadinessStatus }) {
  if (status === "valid") return <span className="text-emerald-400">✓</span>;
  if (status === "blocked") return <span className="text-rose-400">✗</span>;
  return <span className="text-amber-300">⚠</span>;
}

export type ExecutionReadinessPanelProps = RiskValidatorProps & {
  outcome: TradeOutcomeVisual;
  /** Short inline line — no large judgment panel */
  inlineNote?: string;
  rows: ReadinessRow[];
};

export default function ExecutionReadinessPanel({
  outcome,
  inlineNote,
  rows,
  ...riskProps
}: ExecutionReadinessPanelProps) {
  const note =
    inlineNote ||
    (outcome === "pending"
      ? "Complete the checklist, then run the risk check."
      : outcome === "valid"
        ? "System checks satisfied for this step."
        : outcome === "adjust"
          ? "Adjust the flagged items before continuing."
          : "Execution is not permitted under current inputs.");

  return (
    <section className="trade-terminal-section rounded-xl border border-slate-800/80 bg-slate-900/40 px-3 py-3 md:px-4">
      <p className="trade-terminal-kicker trade-terminal-check-heading">Execution readiness</p>
      <p className="mb-3 text-xs leading-snug text-slate-500">{note}</p>
      <ul className="mb-3 space-y-2" aria-label="Readiness checklist">
        {rows.map((row) => (
          <li key={row.id} className="flex items-start gap-2 text-sm text-slate-200">
            <span className="mt-0.5 w-5 shrink-0 text-center font-semibold" aria-hidden>
              <Mark status={row.status} />
            </span>
            <span className="min-w-0 leading-snug">{row.label}</span>
          </li>
        ))}
      </ul>
      <div className="border-t border-slate-800/70 pt-3 text-xs text-slate-400 [&_.trade-terminal-line]:text-xs">
        <RiskValidator {...riskProps} />
      </div>
    </section>
  );
}
