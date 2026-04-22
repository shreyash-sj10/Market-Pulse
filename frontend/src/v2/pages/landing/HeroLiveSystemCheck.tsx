/**
 * Static preview of the pre-trade readout — illustrative only (no API).
 */
export default function HeroLiveSystemCheck() {
  const rows = [
    { label: "Risk alignment", value: "0.84", tone: "ok" as const },
    { label: "Behavior signal", value: "0.72", tone: "mid" as const },
    { label: "Rule conformance", value: "0.96", tone: "ok" as const },
  ];

  return (
    <div
      className="relative overflow-hidden rounded-[var(--radius-lg)] border border-[color-mix(in_srgb,var(--v2-accent-primary)_28%,var(--v2-border-subtle))] bg-[color-mix(in_srgb,var(--v2-bg-card)_88%,black_12%)] p-4 shadow-[0_0_0_1px_color-mix(in_srgb,var(--v2-accent-primary)_12%,transparent),0_24px_64px_-24px_color-mix(in_srgb,var(--v2-accent-primary)_35%,transparent),var(--shadow-md)] sm:p-5"
      aria-hidden="true"
    >
      <div
        className="pointer-events-none absolute -right-1/4 top-0 h-3/5 w-3/5 opacity-[0.35]"
        style={{
          background:
            "radial-gradient(ellipse 70% 70% at 70% 0%, color-mix(in srgb, var(--v2-accent-primary) 18%, transparent) 0%, transparent 65%)",
        }}
      />
      <div className="relative">
        <p className="m-0 font-mono text-[length:var(--text-2xs)] font-semibold uppercase tracking-[var(--tracking-widest)] text-[var(--v2-text-muted)]">
          Live system check
        </p>
        <p className="mt-1.5 max-w-[20rem] text-pretty text-[length:var(--text-xs)] leading-snug text-[var(--v2-text-secondary)]">
          Pre-trade evaluation — current market context
        </p>
        <div className="mt-4 space-y-3">
          {rows.map((r) => (
            <div
              key={r.label}
              className="flex items-baseline justify-between gap-4 border-b border-[var(--v2-border-subtle)] pb-2 last:border-0 last:pb-0"
            >
              <span className="text-[length:var(--text-sm)] text-[var(--v2-text-secondary)]">{r.label}</span>
              <span
                className={`font-mono text-[length:var(--text-sm)] font-semibold tabular-nums ${
                  r.tone === "ok" ? "text-[var(--v2-state-success)]" : "text-[var(--v2-state-warning)]"
                }`}
              >
                {r.value}
              </span>
            </div>
          ))}
        </div>
        <div className="mt-5 rounded-[var(--radius-md)] border border-[color-mix(in_srgb,var(--v2-accent-primary)_35%,var(--v2-border-subtle))] bg-[color-mix(in_srgb,var(--v2-accent-soft)_55%,transparent)] px-3 py-2.5">
          <p className="m-0 font-mono text-[length:var(--text-xs)] font-semibold uppercase tracking-wide text-[var(--v2-text-accent)]">
            Allowed → Execution permitted under constraints
          </p>
        </div>
      </div>
    </div>
  );
}
