import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import AppLayout from "../../layout/AppLayout/AppLayout.jsx";
import { useHomeViewModel } from "./useHomeViewModel";
import { openDecisionPanel } from "../../trade-flow";
import { ROUTES } from "../../routing/routes";
import MetricBlock from "./components/MetricBlock";
import NextActionPanel from "./components/NextActionPanel";
import AttentionCard from "./components/AttentionCard";
import PositionRow from "./components/PositionRow";
import BehaviorInsight from "./components/BehaviorInsight";
import EventLog from "./components/EventLog";
import {
  attentionCtaLabel,
  positionStatusFromDecision,
  formatEntryInr,
} from "./mapHomeViewModel";
import type { DecisionCardProps } from "../../components/decision/DecisionCard";

function openPanelFromItem(item: DecisionCardProps): void {
  openDecisionPanel(item.title, {
    decision: item.decision,
    meta:     item.meta,
    warnings: [],
  });
}

export default function HomePage() {
  const vm = useHomeViewModel();
  const navigate = useNavigate();
  const [behaviorAck, setBehaviorAck] = useState(false);

  const onReviewNext = useCallback(() => {
    if (vm.nextAction.variant === "review_attention") {
      openPanelFromItem(vm.nextAction.topItem);
    }
  }, [vm.nextAction]);

  return (
    <AppLayout>
      <div className="home-terminal">
        {/* SECTION 1 — SYSTEM STATE */}
        <section className="home-terminal__metrics" aria-label="Account state">
          <MetricBlock
            label="Net equity"
            value={vm.systemState.netEquityDisplay}
            sub="Total account value"
          />
          <MetricBlock
            label="Unrealized P&L"
            value={vm.systemState.unrealizedPnlDisplay}
            sub="Open positions vs entry"
          />
          <MetricBlock
            label="Risk / status"
            value={vm.systemState.riskStatusHeadline}
            sub={vm.systemState.riskStatusSub}
            valueTone="status"
          />
        </section>

        {/* SECTION 2 — NEXT ACTION */}
        <NextActionPanel model={vm.nextAction} onReview={onReviewNext} />

        <div className="home-terminal__grid">
          <div className="home-terminal__main">
            {/* SECTION 3 — ATTENTION (conditional) */}
            {vm.attentionTop3.length > 0 ? (
              <section className="home-panel" aria-label="Attention queue">
                <header className="home-panel__head">
                  <h2 className="home-panel__title">Attention required</h2>
                  <p className="home-panel__lead">
                    Sorted by urgency (BLOCK → GUIDE → ACT). Showing up to three items.
                  </p>
                </header>
                <div className="home-panel__stack">
                  {vm.attentionTop3.map((item, idx) => (
                    <AttentionCard
                      key={`${item.title}-${item.decision.action}-${idx}`}
                      tag={item.decision.action}
                      symbol={item.title}
                      reason={item.decision.reason}
                      confidence={item.decision.confidence}
                      ctaLabel={attentionCtaLabel(item.decision.action)}
                      onAction={() => openPanelFromItem(item)}
                    />
                  ))}
                </div>
              </section>
            ) : null}

            {/* SECTION 4 — ACTIVE POSITIONS */}
            <section className="home-panel" aria-label="Open positions">
              <header className="home-panel__head">
                <h2 className="home-panel__title">Active positions</h2>
                <p className="home-panel__lead">Symbol · entry · status · P&amp;L — all from your portfolio feed.</p>
              </header>
              {vm.positions.length === 0 ? (
                <div className="home-empty-pos">
                  <p className="home-empty-pos__text">You have no active positions</p>
                  <button
                    type="button"
                    className="home-empty-pos__cta"
                    onClick={() => navigate(ROUTES.markets)}
                  >
                    Explore Markets
                  </button>
                </div>
              ) : (
                <div className="home-pos-head" aria-hidden>
                  <span>Symbol</span>
                  <span>Entry</span>
                  <span>Status</span>
                  <span>P&amp;L %</span>
                  <span />
                </div>
              )}
              {vm.positions.map((row) => {
                const pnl = row.meta?.pnlPct ?? 0;
                const pnlStr = `${pnl > 0 ? "+" : ""}${pnl.toFixed(2)}%`;
                return (
                  <PositionRow
                    key={row.title}
                    symbol={row.title}
                    entryDisplay={formatEntryInr(row.meta?.avgPricePaise)}
                    statusLabel={positionStatusFromDecision(row.decision.action)}
                    pnlPctDisplay={pnlStr}
                    onReview={() => openPanelFromItem(row)}
                  />
                );
              })}
            </section>
          </div>

          {/* SECTION 5 — CONTEXT */}
          <aside className="home-terminal__aside" aria-label="Context">
            <section className="home-panel home-panel--compact">
              <header className="home-panel__head">
                <h2 className="home-panel__title">Behavior insight</h2>
                <p className="home-panel__lead">From your profile learning feed.</p>
              </header>
              <BehaviorInsight
                model={vm.behaviorInsight}
                acknowledged={behaviorAck}
                onAcknowledge={() => setBehaviorAck(true)}
              />
            </section>

            <section className="home-panel home-panel--compact">
              <header className="home-panel__head">
                <h2 className="home-panel__title">Event log</h2>
                <p className="home-panel__lead">Trace stream from the server.</p>
              </header>
              <EventLog entries={vm.eventLogs} />
            </section>
          </aside>
        </div>
      </div>
    </AppLayout>
  );
}
