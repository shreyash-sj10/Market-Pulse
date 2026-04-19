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

/** Quiet pre-trade gate line — does not compete with order entry. */
export default function TradeSystemVerdict({ verdict, explanation }: TradeSystemVerdictProps) {
  const mod =
    verdict === "ALLOWED"
      ? "trade-terminal-verdict trade-terminal-verdict--strip trade-terminal-verdict--allowed"
      : verdict === "GUIDED"
        ? "trade-terminal-verdict trade-terminal-verdict--strip trade-terminal-verdict--guided"
        : "trade-terminal-verdict trade-terminal-verdict--strip trade-terminal-verdict--blocked";

  return (
    <section className={mod} aria-label="Pre-trade gate">
      <div className="trade-terminal-verdict__strip-inner">
        <span className="trade-terminal-verdict__pill">{LABEL[verdict]}</span>
        <p className="trade-terminal-verdict__explain">{explanation}</p>
      </div>
    </section>
  );
}
