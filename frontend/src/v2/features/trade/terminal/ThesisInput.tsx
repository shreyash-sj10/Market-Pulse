export type ThesisInputProps = {
  value: string;
  onChange: (v: string) => void;
  minLength: number;
  disabled?: boolean;
  /** When profile marks thesis MANDATORY, emphasize system binding. */
  mandatory?: boolean;
};

export default function ThesisInput({ value, onChange, minLength, disabled, mandatory }: ThesisInputProps) {
  const ok = value.trim().length >= minLength;
  const label = mandatory ? "Trade thesis (system mandatory)" : "Trade thesis (required)";
  return (
    <div className="trade-terminal-section">
      <label className="trade-terminal-kicker trade-terminal-kicker--label" htmlFor="trade-thesis">
        {label}
      </label>
      <textarea
        id="trade-thesis"
        className="dp-input dp-textarea trade-terminal-thesis"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Setup, catalyst, invalidation, and what would prove you wrong."
        rows={3}
        disabled={disabled}
      />
      <p className={`trade-terminal-thesis-meta ${ok ? "trade-terminal-thesis-meta--ok" : ""}`}>
        {value.trim().length} / {minLength} characters (minimum)
      </p>
    </div>
  );
}
