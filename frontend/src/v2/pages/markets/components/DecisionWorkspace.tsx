import { useMemo } from "react";
import type { MarketStock } from "../../../hooks/useMarketExplorer";
import type { DecisionCardProps } from "../../../components/decision/DecisionCard";
import { resolveMarketDecisionCard } from "../../../hooks/useMarketDecisions";
import {
  buildDecisionContextSummaryLines,
  buildSuggestedAction,
} from "../decisionContextSummary";
import DecisionSummary from "./DecisionSummary";
import { formatMarketPrice, marketExchangeLabel } from "../marketsFormat";
import { scannerSignalFromStock } from "../marketSignals";
import IntelligenceBlock from "./IntelligenceBlock";
import FundamentalsPanel from "./FundamentalsPanel";
import TechnicalsPanel from "./TechnicalsPanel";

export type DecisionWorkspaceProps = {
  selected: MarketStock;
  marketDecisionItems: DecisionCardProps[];
  onOpenTradePanel: () => void;
};

export default function DecisionWorkspace({
  selected,
  marketDecisionItems,
  onOpenTradePanel,
}: DecisionWorkspaceProps) {
  const symKey = selected.fullSymbol ?? selected.symbol;

  const card = useMemo(
    () => resolveMarketDecisionCard(selected, marketDecisionItems),
    [selected, marketDecisionItems],
  );

  const summaryLines = useMemo(
    () => buildDecisionContextSummaryLines(card.decision, selected),
    [card.decision, selected],
  );

  const suggested = useMemo(() => buildSuggestedAction(card.decision), [card.decision]);
  const scannerSig = useMemo(() => scannerSignalFromStock(selected), [selected]);

  return (
    <div className="markets-workspace markets-workspace--flow workspace-flow-doc">
      <header className="workspace-flow-header">
        <div className="workspace-flow-header__row">
          <span className="workspace-flow-symbol">{selected.symbol}</span>
          <span className="workspace-flow-price">
            {selected.pricePaise > 0 ? formatMarketPrice(selected.pricePaise, selected.isFallback) : "—"}
          </span>
        </div>
        <div className="workspace-flow-header__sub">
          <span>
            {selected.fullSymbol} · {marketExchangeLabel(selected.fullSymbol)}
          </span>
          <span className={`workspace-change--${selected.changePercent >= 0 ? "up" : "down"}`}>
            {selected.changePercent > 0 ? "+" : ""}
            {selected.changePercent.toFixed(2)}%
          </span>
        </div>
      </header>

      <div className="workspace-flow-region">
        <p className="workspace-flow-kicker">Decision context</p>
        <DecisionSummary lines={summaryLines} />
      </div>

      <div className="workspace-flow-region workspace-flow-region--intel-prominent">
        <p className="workspace-flow-kicker workspace-flow-kicker--prominent">Intelligence</p>
        <IntelligenceBlock symbol={symKey} />
      </div>

      <div className="workspace-flow-region">
        <p className="workspace-flow-kicker">Signal & decision</p>
        <p className={`workspace-flow-signal-primary ${scannerSig.cls}`}>{scannerSig.label}</p>
        <p className="workspace-flow-confidence">
          Engine confidence {card.decision.confidence}% · posture {card.decision.action}
        </p>
        <p className="workspace-flow-action">{suggested}</p>
      </div>

      <div className="workspace-flow-region workspace-flow-region--cta">
        <button type="button" className="workspace-primary-cta" onClick={onOpenTradePanel}>
          Open Trade Panel
        </button>
      </div>

      <div className="workspace-flow-region workspace-flow-region--analysis">
        <p className="workspace-flow-kicker">Analysis</p>
        <div className="workspace-analysis-split">
          <FundamentalsPanel symbol={symKey} selected={selected} />
          <TechnicalsPanel symbol={symKey} selected={selected} />
        </div>
      </div>
    </div>
  );
}
