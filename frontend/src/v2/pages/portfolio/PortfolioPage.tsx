import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AlertTriangle, CheckCircle } from "lucide-react";
import AppLayout from "../../layout/AppLayout/AppLayout.jsx";
import { usePortfolioDecisions } from "./usePortfolioDecisions";
import { usePortfolioSummary } from "../../hooks/usePortfolioSummary";
import { useClosedPositions } from "../../hooks/useClosedPositions";
import { useTraceData } from "../../hooks/useTraceData";
import { TRADE_SUCCESS_SESSION_KEY } from "../../trade-flow";
import { formatINR, fromPaise } from "../../../utils/currency.utils";
import type { DecisionCardProps } from "../../components/decision/DecisionCard";
import DecisionPanel from "../../features/trade/DecisionPanel";
import type { TradePanelContext } from "../../trade-flow";
import MetricBlock from "../home/components/MetricBlock";
import EventLog from "../home/components/EventLog";
import { buildEventLogs } from "../home/mapHomeViewModel";
import PortfolioDecisionStrip, { PortfolioClosedStrip, PortfolioPendingStrip } from "./PortfolioDecisionStrip";
import { buildPortfolioSessionLogs } from "./portfolioSessionLogs";
import { ROUTES } from "../../routing/routes";
import type { PortfolioSummary } from "../../hooks/usePortfolioSummary";

type PortfolioTab = "Active Positions" | "Pending Orders" | "Closed History";

function exposurePct(netEquityPaise: number, investedPaise: number): number | null {
  if (!Number.isFinite(netEquityPaise) || netEquityPaise <= 0) return null;
  if (!Number.isFinite(investedPaise) || investedPaise <= 0) return 0;
  return Math.min(100, (investedPaise / netEquityPaise) * 100);
}

function activeRiskPct(items: DecisionCardProps[]): number | null {
  if (items.length === 0) return null;
  const weight = (a: string) => (a === "BLOCK" ? 92 : a === "GUIDE" ? 48 : 12);
  const sum = items.reduce((s, i) => s + weight(i.decision.action), 0);
  return Math.round((sum / items.length) * 10) / 10;
}

type IntelBlock = { concentration: string; weak: string; sentimentShift: string };

function buildPortfolioIntel(items: DecisionCardProps[], summary: PortfolioSummary): IntelBlock {
  if (items.length === 0) {
    return {
      concentration:
        "No deployed capital — concentration risk is zero until you open a line.",
      weak: "No weak legs in the book; add positions to surface underperformers vs entry.",
      sentimentShift:
        "Posture is idle: decision engine has no live holdings to bias toward risk-on or risk-off.",
    };
  }

  const notionals = items.map((i) => {
    const avg = Number(i.meta?.avgPricePaise ?? 0);
    const q = Number(i.meta?.quantity ?? 0);
    return { sym: i.title, n: Math.max(0, avg) * Math.max(0, q) };
  });
  const totalN = notionals.reduce((s, x) => s + x.n, 0);
  const top = [...notionals].sort((a, b) => b.n - a.n)[0];
  const topPct = totalN > 0 && top ? (top.n / totalN) * 100 : 0;

  let concentration: string;
  if (totalN <= 0) {
    concentration = "Sizing data is thin — concentration will sharpen as fills sync.";
  } else if (topPct > 48) {
    concentration = `Heavy line: ${top.sym} is ~${topPct.toFixed(0)}% of estimated notional. Trim or hedge if policy caps single-name exposure.`;
  } else if (topPct > 28) {
    concentration = `Largest sleeve is ${top.sym} (~${topPct.toFixed(0)}% of book). Monitor correlation if you add beta in the same sector.`;
  } else {
    concentration = `Book is spread — top name ~${topPct.toFixed(0)}% across ${items.length} open line(s).`;
  }

  const sortedByPnl = [...items].sort((a, b) => (a.meta?.pnlPct ?? 0) - (b.meta?.pnlPct ?? 0));
  const weakest = sortedByPnl[0];
  const wp = weakest?.meta?.pnlPct ?? 0;
  let weak: string;
  if (wp < -2.5) {
    weak = `Weakest mark: ${weakest.title} (${wp.toFixed(2)}% vs entry). Treat as first candidate for review or de-risk.`;
  } else if (wp < 0.5) {
    weak = `Laggard: ${weakest.title} at ${wp.toFixed(2)}% — still inside band but worth watching if volatility picks up.`;
  } else {
    weak = `No meaningful drag — even the softest line (${weakest.title}) is ${wp.toFixed(2)}% vs entry.`;
  }

  const blocks = items.filter((i) => i.decision.action === "BLOCK").length;
  const guides = items.filter((i) => i.decision.action === "GUIDE").length;
  const unreal = summary.unrealizedPnLPaise ?? 0;
  const bias = unreal > 0 ? "mark-to-market is net positive" : unreal < 0 ? "mark-to-market is net negative" : "unrealized P&L is flat";

  let sentimentShift: string;
  if (blocks > 0) {
    sentimentShift = `Sentiment shift: defensive — ${blocks} position(s) at breach while ${bias}.`;
  } else if (guides > 0) {
    sentimentShift = `Sentiment shift: cautious — ${guides} guided review(s); ${bias}.`;
  } else {
    sentimentShift = `Sentiment shift: stable — decisions read ACT across the book; ${bias}.`;
  }

  return { concentration, weak, sentimentShift };
}

export default function PortfolioPage() {
  const portfolio = usePortfolioDecisions();
  const { summary, isError: summaryError, isLoading: summaryLoading } = usePortfolioSummary();
  const closed = useClosedPositions();
  const trace = useTraceData();
  const navigate = useNavigate();
  const [tab, setTab] = useState<PortfolioTab>("Active Positions");
  const [tradeBanner, setTradeBanner] = useState(false);
  const [panel, setPanel] = useState<{ symbol: string; ctx: TradePanelContext } | null>(null);

  useEffect(() => {
    if (sessionStorage.getItem(TRADE_SUCCESS_SESSION_KEY) === "1") {
      setTradeBanner(true);
      sessionStorage.removeItem(TRADE_SUCCESS_SESSION_KEY);
    }
  }, []);

  const netEquity = summary.netEquityPaise ?? summary.balancePaise ?? 0;
  const unrealizedPnL = summary.unrealizedPnLPaise ?? 0;
  const pnlPct = summary.totalPnlPct ?? 0;
  const invested = summary.totalInvestedPaise ?? 0;

  const exp = exposurePct(netEquity, invested);
  const riskPct = activeRiskPct(portfolio.items);
  const intel = useMemo(
    () => buildPortfolioIntel(portfolio.items, summary),
    [portfolio.items, summary],
  );
  const eventEntries = useMemo(() => buildEventLogs(trace.lines, 16), [trace.lines]);

  const breachCount = useMemo(
    () => portfolio.items.filter((i) => i.decision?.action === "BLOCK").length,
    [portfolio.items],
  );
  const atRiskCount = useMemo(
    () => portfolio.items.filter((i) => i.decision?.action === "GUIDE").length,
    [portfolio.items],
  );

  const portfolioLogAnchor = useMemo(
    () =>
      `${portfolio.items.map((i) => `${i.title}:${i.decision?.action}:${i.meta?.pnlPct}`).join("|")}|${netEquity}|${unrealizedPnL}`,
    [portfolio.items, netEquity, unrealizedPnL],
  );

  const portfolioSessionEntries = useMemo(() => {
    const anchorMs = Date.now();
    return buildPortfolioSessionLogs({
      positionCount: portfolio.items.length,
      breachCount,
      atRiskCount,
      anchorMs,
    });
  }, [portfolio.items.length, breachCount, atRiskCount, portfolioLogAnchor]);

  const mergedEventEntries = useMemo(
    () => [...portfolioSessionEntries, ...eventEntries].slice(0, 28),
    [portfolioSessionEntries, eventEntries],
  );

  function openTradeReview(item: DecisionCardProps) {
    setPanel({
      symbol: item.title,
      ctx: {
        decision: item.decision,
        meta: {
          pnlPct: item.meta?.pnlPct,
          quantity: item.meta?.quantity,
          avgPricePaise: item.meta?.avgPricePaise,
        },
        warnings: [],
      },
    });
  }

  const exposureDisplay =
    exp == null ? "—" : exp === 0 && invested <= 0 ? "0%" : `${exp.toFixed(1)}%`;
  const activeRiskDisplay = riskPct == null ? "—" : `${riskPct.toFixed(1)}%`;

  return (
    <AppLayout>
      <div className="home-terminal portfolio-page">
        <div className="portfolio-header portfolio-header--aligned">
          {tradeBanner && (
            <div
              className="degraded-banner"
              style={{
                background: "var(--v2-state-success-bg)",
                borderColor: "var(--v2-state-success)",
                color: "var(--v2-state-success)",
              }}
            >
              <CheckCircle size={12} /> Trade executed and recorded successfully.
            </div>
          )}
          {summaryError && (
            <div className="degraded-banner">
              <AlertTriangle size={12} /> Portfolio summary unavailable — retrying
            </div>
          )}

          <section className="portfolio-state-metrics" aria-label="Portfolio state">
            <MetricBlock
              label="Total equity"
              value={netEquity > 0 ? formatINR(netEquity) : "—"}
              sub="Account value"
            />
            <MetricBlock
              label="Unrealized PnL"
              value={netEquity > 0 ? `${unrealizedPnL >= 0 ? "+" : ""}${formatINR(unrealizedPnL)}` : "—"}
              sub="Open vs entry"
            />
            <MetricBlock
              label="PnL %"
              value={pnlPct !== 0 ? `${pnlPct > 0 ? "+" : ""}${pnlPct.toFixed(2)}%` : "—"}
              sub="Vs cost basis"
            />
            <MetricBlock
              label="Exposure %"
              value={exposureDisplay}
              sub="Invested / equity"
            />
            <MetricBlock
              label="Active risk %"
              value={activeRiskDisplay}
              sub="From decision mix"
              valueTone="status"
            />
          </section>

          <div className="portfolio-tabs" role="tablist" aria-label="Portfolio sections">
            {(
              [
                ["Active Positions", portfolio.items.length] as const,
                ["Pending Orders", summary.pendingOrders.length] as const,
                ["Closed History", closed.trades.length] as const,
              ] as const
            ).map(([t, count]) => (
              <button
                key={t}
                type="button"
                role="tab"
                aria-selected={tab === t}
                className={`portfolio-tab ${tab === t ? "portfolio-tab--active" : ""}`}
                onClick={() => setTab(t)}
              >
                {t} ({count})
              </button>
            ))}
          </div>
        </div>

        <div className="home-terminal__grid portfolio-body">
          <div className="home-terminal__main portfolio-main-stack">
            {tab === "Active Positions" ? (
              portfolio.isLoading ? (
                <p className="page-loading page-note" style={{ padding: "var(--space-6)" }}>
                  Loading positions…
                </p>
              ) : portfolio.isError ? (
                <div className="degraded-banner" style={{ margin: 0 }}>
                  <AlertTriangle size={12} /> Position data unavailable — retrying
                </div>
              ) : portfolio.items.length === 0 ? (
                <div className="portfolio-empty-action">
                  <div className="portfolio-empty-action__card">
                    <h2 className="portfolio-empty-action__title">Start your first trade</h2>
                    <p className="portfolio-empty-action__body">
                      You have no open positions. Explore the market scanner to place a trade.
                    </p>
                    <button
                      type="button"
                      className="portfolio-empty-action__cta"
                      onClick={() => navigate(ROUTES.markets)}
                    >
                      Explore Markets
                    </button>
                  </div>
                </div>
              ) : (
                <section className="home-panel portfolio-decisions-panel" aria-label="Open positions">
                  <header className="home-panel__head">
                    <h2 className="home-panel__title">Open positions</h2>
                    <p className="home-panel__lead">
                      Decision strips — plan state drives the row; review opens the trade terminal.
                    </p>
                  </header>
                  <div className="portfolio-decision-strips">
                    {portfolio.items.map((item, i) => (
                      <PortfolioDecisionStrip
                        key={`${item.title}-${i}`}
                        item={item}
                        onReview={() => openTradeReview(item)}
                      />
                    ))}
                  </div>
                </section>
              )
            ) : tab === "Pending Orders" ? (
              summaryLoading ? (
                <p className="page-loading page-note" style={{ padding: "var(--space-6)" }}>
                  Loading queued orders…
                </p>
              ) : summaryError ? (
                <div className="degraded-banner" style={{ margin: 0 }}>
                  <AlertTriangle size={12} /> Could not load queued orders — retrying
                </div>
              ) : summary.pendingOrders.length === 0 ? (
                <section className="home-panel portfolio-decisions-panel" aria-label="Pending orders">
                  <header className="home-panel__head">
                    <h2 className="home-panel__title">Pending orders</h2>
                    <p className="home-panel__lead">
                      Nothing in the execution queue. Orders you place outside cash market hours are held here
                      until the session opens.
                    </p>
                  </header>
                  <p className="page-note" style={{ padding: "var(--space-5)" }}>
                    No pending orders.
                  </p>
                </section>
              ) : (
                <section className="home-panel portfolio-decisions-panel" aria-label="Pending orders">
                  <header className="home-panel__head">
                    <h2 className="home-panel__title">Pending orders</h2>
                    <p className="home-panel__lead">
                      Submitted while the market was closed or execution was deferred — fills when the exchange
                      session is active.
                    </p>
                  </header>
                  <div className="portfolio-decision-strips">
                    {summary.pendingOrders.map((order) => (
                      <PortfolioPendingStrip
                        key={order.tradeId}
                        order={order}
                        formatPriceInr={(paise) => `₹${fromPaise(paise).toFixed(2)}`}
                        formatNotionalInr={(paise) => formatINR(paise)}
                      />
                    ))}
                  </div>
                </section>
              )
            ) : closed.isLoading ? (
              <p className="page-loading page-note" style={{ padding: "var(--space-6)" }}>
                Loading trade history…
              </p>
            ) : closed.isError ? (
              <div className="degraded-banner" style={{ margin: 0 }}>
                <AlertTriangle size={12} /> Trade history unavailable — retrying
              </div>
            ) : closed.trades.length === 0 ? (
              <section className="home-panel portfolio-decisions-panel" aria-label="Closed history">
                <header className="home-panel__head">
                  <h2 className="home-panel__title">Closed history</h2>
                  <p className="home-panel__lead">Completed trades will appear here.</p>
                </header>
                <p className="page-note" style={{ padding: "var(--space-5)" }}>
                  No completed trades yet.
                </p>
              </section>
            ) : (
              <section className="home-panel portfolio-decisions-panel" aria-label="Closed history">
                <header className="home-panel__head">
                  <h2 className="home-panel__title">Closed history</h2>
                  <p className="home-panel__lead">Recently squared positions.</p>
                </header>
                <div className="portfolio-decision-strips">
                  {closed.trades.map((trade) => (
                    <PortfolioClosedStrip
                      key={trade.tradeId}
                      trade={trade}
                      formatExitInr={(paise) => `₹${fromPaise(paise).toFixed(2)}`}
                      formatPnlInr={(paise) => formatINR(paise)}
                    />
                  ))}
                </div>
              </section>
            )}
          </div>

          <aside className="home-terminal__aside" aria-label="Portfolio context">
            <section className="home-panel home-panel--compact">
              <header className="home-panel__head">
                <h2 className="home-panel__title">Portfolio intelligence</h2>
                <p className="home-panel__lead">Derived from open lines and summary fields.</p>
              </header>
              <div className="portfolio-intel">
                <p className="portfolio-intel__block">
                  <span className="portfolio-intel__label">Risk concentration</span>
                  {intel.concentration}
                </p>
                <p className="portfolio-intel__block">
                  <span className="portfolio-intel__label">Weak positions</span>
                  {intel.weak}
                </p>
                <p className="portfolio-intel__block">
                  <span className="portfolio-intel__label">Sentiment shift</span>
                  {intel.sentimentShift}
                </p>
              </div>
            </section>

            <section className="home-panel home-panel--compact">
              <header className="home-panel__head">
                <h2 className="home-panel__title">Event log</h2>
                <p className="home-panel__lead">Trace stream from the server.</p>
              </header>
              {trace.isLoading ? (
                <p className="page-note" style={{ padding: "var(--space-3) var(--space-4)" }}>
                  Loading trace…
                </p>
              ) : trace.isError ? (
                <p className="page-note" style={{ padding: "var(--space-3) var(--space-4)" }}>
                  Trace unavailable.
                </p>
              ) : (
                <EventLog entries={mergedEventEntries} dense />
              )}
            </section>
          </aside>
        </div>
      </div>

      <DecisionPanel
        open={panel !== null}
        symbol={panel?.symbol ?? null}
        context={panel?.ctx ?? null}
        onClose={() => setPanel(null)}
      />
    </AppLayout>
  );
}
