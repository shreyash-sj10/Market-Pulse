type MetricBlockProps = {
  label: string;
  value: string;
  sub?: string;
  /** Use for status text (risk headline) — slightly smaller than currency figures */
  valueTone?: "currency" | "status";
};

/** System state metric — value dominant, subtext muted. Token-only surfaces. */
export default function MetricBlock({ label, value, sub, valueTone = "currency" }: MetricBlockProps) {
  const valueCls =
    valueTone === "status" ? "home-metric__value home-metric__value--status" : "home-metric__value";
  return (
    <div className="home-metric">
      <p className="home-metric__label">{label}</p>
      <p className={valueCls}>{value}</p>
      {sub ? <p className="home-metric__sub">{sub}</p> : null}
    </div>
  );
}
