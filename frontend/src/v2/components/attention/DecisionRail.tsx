import type { RailState } from "../../intelligence/integration";

type Props = { state: RailState; message: string };

export default function DecisionRail({ state, message }: Props) {
  const mod =
    state === "ok"
      ? "decision-rail decision-rail--ok"
      : state === "warn"
        ? "decision-rail decision-rail--warn"
        : "decision-rail decision-rail--degraded";

  const label =
    state === "ok" ? "OK" : state === "warn" ? "WARN" : "DEGRADED";

  return (
    <div className={`card ${mod}`} role="status">
      <p className="decision-rail__state">[{label}]</p>
      <p className="decision-rail__message page-note">{message}</p>
    </div>
  );
}
