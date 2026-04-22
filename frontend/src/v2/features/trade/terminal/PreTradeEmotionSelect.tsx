import { PRE_TRADE_EMOTION_OPTIONS, type PreTradeEmotionId } from "./preTradeEmotions";

export type PreTradeEmotionSelectProps = {
  value: PreTradeEmotionId | "";
  onChange: (v: PreTradeEmotionId) => void;
  disabled?: boolean;
};

const GROUPS: { title: string; hint: string; ids: readonly PreTradeEmotionId[] }[] = [
  {
    title: "Clear & disciplined",
    hint: "Baseline execution mindset",
    ids: ["CALM", "DISCIPLINED", "CONFIDENT"],
  },
  {
    title: "Uncertain or tense",
    hint: "Slow down sizing",
    ids: ["UNCERTAIN", "ANXIOUS"],
  },
  {
    title: "Charged / impulse risk",
    hint: "Higher odds of oversize or chase",
    ids: ["FOMO", "EXCITED"],
  },
  {
    title: "Tilt / recovery",
    hint: "Do not add risk without a reset",
    ids: ["REVENGE", "FRUSTRATED"],
  },
];

function labelFor(id: PreTradeEmotionId): string {
  return PRE_TRADE_EMOTION_OPTIONS.find((o) => o.id === id)?.label ?? id;
}

export default function PreTradeEmotionSelect({ value, onChange, disabled }: PreTradeEmotionSelectProps) {
  return (
    <div className="trade-terminal-section">
      <p className="trade-terminal-kicker trade-terminal-kicker--label" id="pre-trade-emotion-label">
        Behavior state
      </p>
      <p className="trade-terminal-field-hint" style={{ marginTop: 0, marginBottom: 8 }}>
        Required for your behavior log. Pick the closest match — this does not go to the exchange.
      </p>
      <div className="space-y-4" role="radiogroup" aria-labelledby="pre-trade-emotion-label">
        {GROUPS.map((g) => (
          <div
            key={g.title}
            role="group"
            aria-label={g.title}
            className="rounded-lg border border-slate-800/80 bg-slate-900/35 px-3 py-3"
          >
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{g.title}</p>
            <p className="mb-2 text-xs text-slate-500">{g.hint}</p>
            <div className="flex flex-wrap gap-2">
              {g.ids.map((id) => {
                const optId = `emotion-${id}`;
                const checked = value === id;
                return (
                  <label
                    key={id}
                    htmlFor={optId}
                    className={`cursor-pointer rounded-md border px-2.5 py-1.5 text-xs font-medium transition ${
                      checked
                        ? "border-cyan-500/60 bg-cyan-500/15 text-cyan-100"
                        : "border-slate-700/80 bg-slate-950/40 text-slate-300 hover:border-slate-500"
                    }`}
                  >
                    <input
                      id={optId}
                      type="radio"
                      name="preTradeEmotion"
                      className="sr-only"
                      value={id}
                      checked={checked}
                      disabled={disabled}
                      onChange={() => onChange(id)}
                    />
                    {labelFor(id)}
                  </label>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
