import type { GateVerdict } from "./executionGateUi";

const LABEL: Record<GateVerdict, string> = {
  ALLOWED: "ALLOWED",
  GUIDED: "GUIDED",
  BLOCKED: "BLOCKED",
};

export type TradeSystemVerdictProps = {
  verdict: GateVerdict;
  explanation: string;
};

export default function TradeSystemVerdict({ verdict, explanation }: TradeSystemVerdictProps) {
  const mod =
    verdict === "ALLOWED"
      ? "trade-terminal-verdict trade-terminal-verdict--allowed"
      : verdict === "GUIDED"
        ? "trade-terminal-verdict trade-terminal-verdict--guided"
        : "trade-terminal-verdict trade-terminal-verdict--blocked";

  return (
    <section className={mod} aria-label="System judgment">
      <p className="trade-terminal-verdict__label">System judgment</p>
      <p className="trade-terminal-verdict__state">{LABEL[verdict]}</p>
      <p className="trade-terminal-verdict__explain">{explanation}</p>
    </section>
  );
}
