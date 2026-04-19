import type { GateVerdict } from "./executionGateUi";

export type TradeSystemVerdictProps = {
  verdict: GateVerdict;
  explanation: string;
};

/** Quiet pre-trade gate line — does not compete with order entry. */
export default function TradeSystemVerdict({ verdict, explanation }: TradeSystemVerdictProps) {
  const mod =
    verdict === "ACT"
      ? "trade-terminal-verdict trade-terminal-verdict--strip trade-terminal-verdict--allowed"
      : verdict === "GUIDE"
        ? "trade-terminal-verdict trade-terminal-verdict--strip trade-terminal-verdict--guided"
        : "trade-terminal-verdict trade-terminal-verdict--strip trade-terminal-verdict--blocked";

  return (
    <section className={mod} aria-label="Pre-trade gate">
      <div className="trade-terminal-verdict__strip-inner">
        <span className="trade-terminal-verdict__pill">{verdict}</span>
        <p className="trade-terminal-verdict__explain">{explanation}</p>
      </div>
    </section>
  );
}
