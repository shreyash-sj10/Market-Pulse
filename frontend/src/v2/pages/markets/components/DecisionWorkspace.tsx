import { useMemo } from "react";
import type { MarketStock } from "../../../hooks/useMarketExplorer";
import type { DecisionCardProps } from "../../../components/decision/DecisionCard";
import { resolveMarketDecisionCard } from "../../../hooks/useMarketDecisions";
import { buildDecisionReasonBullets } from "../decisionContextSummary";
import { formatMarketPrice, marketExchangeLabel } from "../marketsFormat";
import IntelligenceBlock from "./IntelligenceBlock";
import FundamentalsPanel from "./FundamentalsPanel";
import TechnicalsPanel from "./TechnicalsPanel";

export type DecisionWorkspaceProps = {
  selected: MarketStock;
  marketDecisionItems: DecisionCardProps[];
  onOpenTradePanel: () => void;
};

function tapeSideLabel(trend: MarketStock["trend"]): "BUY" | "SELL" | "NEUTRAL" {
  if (trend === "BULLISH") return "BUY";
  if (trend === "BEARISH") return "SELL";
  return "NEUTRAL";
}

function engineActionClass(action: "ACT" | "GUIDE" | "BLOCK"): string {
  if (action === "ACT") return "workspace-decision-tag--act";
  if (action === "BLOCK") return "workspace-decision-tag--block";
  return "workspace-decision-tag--guide";
}

function sideTagClass(side: "BUY" | "SELL" | "NEUTRAL"): string {
  if (side === "BUY") return "workspace-side-tag--buy";
  if (side === "SELL") return "workspace-side-tag--sell";
  return "workspace-side-tag--neutral";
}

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

  const bullets = useMemo(
    () => buildDecisionReasonBullets(card.decision, selected),
    [card.decision, selected],
  );

  const side = tapeSideLabel(selected.trend);

  return (
    <div className="markets-workspace markets-workspace--flow workspace-terminal">
      <header className="workspace-terminal__header">
        <div className="workspace-terminal__header-main">
          <span className="workspace-terminal__symbol">{selected.symbol}</span>
          <span className="workspace-terminal__price">
            {selected.pricePaise > 0 ? formatMarketPrice(selected.pricePaise, selected.isFallback) : "—"}
          </span>
        </div>
        <div className="workspace-terminal__header-meta">
          <span className="workspace-terminal__meta-muted">
            {selected.fullSymbol} · {marketExchangeLabel(selected.fullSymbol)}
          </span>
          <span className={`workspace-terminal__chg ${selected.changePercent >= 0 ? "workspace-change--up" : "workspace-change--down"}`}>
            {selected.changePercent > 0 ? "+" : ""}
            {selected.changePercent.toFixed(2)}% day
          </span>
        </div>
      </header>

      <section className="workspace-terminal__section" aria-labelledby="ws-decision-label">
        <h2 id="ws-decision-label" className="workspace-terminal__label">
          Decision
        </h2>
        <div className="workspace-terminal__decision-compact">
          <span className={`workspace-decision-tag ${engineActionClass(card.decision.action)}`}>{card.decision.action}</span>
          <span className="workspace-terminal__decision-arrow" aria-hidden>
            →
          </span>
          <span className={`workspace-side-tag ${sideTagClass(side)}`}>{side}</span>
          <span className="workspace-terminal__confidence workspace-terminal__confidence--inline">
            Confidence: {card.decision.confidence}%
          </span>
        </div>
      </section>

      <section className="workspace-terminal__section" aria-labelledby="ws-reason-label">
        <h2 id="ws-reason-label" className="workspace-terminal__label">
          Reason
        </h2>
        <ul className="workspace-reason-list">
          <li>
            <span className="workspace-reason-list__k">Trend</span>
            {bullets.trend}
          </li>
          <li>
            <span className="workspace-reason-list__k">Volume</span>
            {bullets.volume}
          </li>
          <li>
            <span className="workspace-reason-list__k">Risk</span>
            {bullets.risk}
          </li>
        </ul>
      </section>

      <section className="workspace-terminal__section" aria-labelledby="ws-intel-label">
        <h2 id="ws-intel-label" className="workspace-terminal__label">
          Intelligence
        </h2>
        <IntelligenceBlock symbol={symKey} />
      </section>

      <section className="workspace-terminal__section workspace-terminal__section--grow" aria-labelledby="ws-analysis-label">
        <h2 id="ws-analysis-label" className="workspace-terminal__label">
          Analysis
        </h2>
        <div className="workspace-analysis-split">
          <FundamentalsPanel symbol={symKey} selected={selected} />
          <TechnicalsPanel symbol={symKey} selected={selected} />
        </div>
      </section>

      <footer className="workspace-terminal__action">
        <button type="button" className="workspace-trade-cta" onClick={onOpenTradePanel}>
          Open Trade Panel
        </button>
      </footer>
    </div>
  );
}
