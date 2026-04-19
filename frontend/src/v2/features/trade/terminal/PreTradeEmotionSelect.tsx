import { PRE_TRADE_EMOTION_OPTIONS, type PreTradeEmotionId } from "./preTradeEmotions";

export type PreTradeEmotionSelectProps = {
  value: PreTradeEmotionId | "";
  onChange: (v: PreTradeEmotionId) => void;
  disabled?: boolean;
};

export default function PreTradeEmotionSelect({ value, onChange, disabled }: PreTradeEmotionSelectProps) {
  return (
    <div className="trade-terminal-section">
      <p className="trade-terminal-kicker trade-terminal-kicker--label" id="pre-trade-emotion-label">
        How do you feel right now?
      </p>
      <p className="trade-terminal-field-hint" style={{ marginTop: 0, marginBottom: 0 }}>
        Required for behavioural analytics (self-assessment, not shown to the market).
      </p>
      <div
        className="trade-terminal-emotion-grid"
        role="radiogroup"
        aria-labelledby="pre-trade-emotion-label"
      >
        {PRE_TRADE_EMOTION_OPTIONS.map((opt) => {
          const id = `emotion-${opt.id}`;
          const checked = value === opt.id;
          return (
            <label
              key={opt.id}
              htmlFor={id}
              className={`trade-terminal-emotion-pill ${checked ? "trade-terminal-emotion-pill--active" : ""}`}
            >
              <input
                id={id}
                type="radio"
                name="preTradeEmotion"
                value={opt.id}
                checked={checked}
                disabled={disabled}
                onChange={() => onChange(opt.id)}
              />
              <span>{opt.label}</span>
            </label>
          );
        })}
      </div>
    </div>
  );
}
