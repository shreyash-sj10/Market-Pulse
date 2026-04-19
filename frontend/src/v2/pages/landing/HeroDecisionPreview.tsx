/**
 * Static preview of the decision terminal readout — illustrative only.
 */
export default function HeroDecisionPreview() {
  const rows = [
    { label: "Risk alignment", value: "0.84", tone: "ok" as const },
    { label: "Behavior signal", value: "0.72", tone: "mid" as const },
    { label: "Rule conformance", value: "0.96", tone: "ok" as const },
  ];

  return (
    <div
      className="rounded-[var(--radius-lg)] border border-[var(--v2-border-subtle)] bg-[var(--v2-bg-card)] p-4 shadow-[var(--shadow-md)] sm:p-5"
      aria-hidden="true"
    >
      <p className="m-0 font-mono text-[length:var(--text-2xs)] font-semibold uppercase tracking-[var(--tracking-widest)] text-[var(--v2-text-muted)]">
        System verdict
      </p>
      <div className="mt-4 space-y-3">
        {rows.map((r) => (
          <div key={r.label} className="flex items-baseline justify-between gap-4 border-b border-[var(--v2-border-subtle)] pb-2 last:border-0 last:pb-0">
            <span className="text-[length:var(--text-sm)] text-[var(--v2-text-secondary)]">{r.label}</span>
            <span
              className={`font-mono text-[length:var(--text-sm)] font-semibold tabular-nums ${
                r.tone === "ok"
                  ? "text-[var(--v2-state-success)]"
                  : "text-[var(--v2-state-warning)]"
              }`}
            >
              {r.value}
            </span>
          </div>
        ))}
      </div>
      <div className="mt-5 rounded-[var(--radius-md)] border border-[var(--v2-accent-border)] bg-[var(--v2-accent-soft)] px-3 py-2.5">
        <div className="flex items-center gap-2">
          <span className="rounded-[var(--radius-sm)] bg-[var(--v2-bg-elevated)] px-2 py-0.5 font-mono text-[length:var(--text-2xs)] font-bold uppercase tracking-wide text-[var(--v2-text-accent)]">
            Allowed
          </span>
          <span className="text-[length:var(--text-xs)] text-[var(--v2-text-secondary)]">
            Gates pass · execution permitted
          </span>
        </div>
      </div>
    </div>
  );
}
