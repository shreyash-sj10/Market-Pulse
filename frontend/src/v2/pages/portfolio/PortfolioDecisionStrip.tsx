import type { DecisionCardProps } from "../../components/decision/DecisionCard";
import { formatEntryInr } from "../home/mapHomeViewModel";

export type PlanTier = "breach" | "at-risk" | "within-plan";

export function planTierFromAction(action: string | undefined): PlanTier {
  if (action === "BLOCK") return "breach";
  if (action === "GUIDE") return "at-risk";
  return "within-plan";
}

function systemContextLine(tier: PlanTier): string {
  if (tier === "breach") return "Stop violated — risk beyond plan";
  if (tier === "at-risk") return "Approaching stop — monitor closely";
  return "Trend intact — no action required";
}

function statusLabel(tier: PlanTier): string {
  if (tier === "breach") return "Breach";
  if (tier === "at-risk") return "At risk";
  return "Within plan";
}

type Props = {
  item: DecisionCardProps;
  onReview: () => void;
};

export type ClosedStripTrade = {
  tradeId: string;
  symbol: string;
  pricePaise: number;
  quantity: number;
  pnlPct: number | null;
  pnlPaise: number | null;
  side: string;
  closedAt?: string | null;
};

type ClosedProps = {
  trade: ClosedStripTrade;
  formatExitInr: (paise: number) => string;
  formatPnlInr: (paise: number) => string;
};

/** Closed history: same rhythm as active strips, neutral system readout (no risk tier). */
export function PortfolioClosedStrip({ trade, formatExitInr, formatPnlInr }: ClosedProps) {
  const pnl = trade.pnlPct;
  const pnlPos = pnl != null && pnl > 0;
  const pnlCls =
    pnl == null
      ? "portfolio-strip__pnl portfolio-strip__pnl--flat"
      : pnlPos
        ? "portfolio-strip__pnl portfolio-strip__pnl--pos"
        : pnl < 0
          ? "portfolio-strip__pnl portfolio-strip__pnl--neg"
          : "portfolio-strip__pnl portfolio-strip__pnl--flat";
  const pnlStr = pnl == null ? "—" : `${pnlPos ? "+" : ""}${pnl.toFixed(2)}%`;
  const date = trade.closedAt ? new Date(trade.closedAt).toLocaleDateString("en-IN") : "—";
  const pnlMoney =
    trade.pnlPaise != null
      ? `${trade.pnlPaise >= 0 ? "+" : ""}${formatPnlInr(trade.pnlPaise)}`
      : null;

  return (
    <article
      className="portfolio-decision-strip portfolio-decision-strip--closed"
      aria-label={`Closed ${trade.symbol}`}
    >
      <div className="portfolio-decision-strip__accent" aria-hidden />
      <div className="portfolio-decision-strip__body">
        <div className="portfolio-decision-strip__left">
          <div className="portfolio-decision-strip__symbol">{trade.symbol}</div>
          <div className="portfolio-decision-strip__entry">
            {formatExitInr(trade.pricePaise)} · {trade.quantity}u · {trade.side}
          </div>
          <p className="portfolio-decision-strip__context portfolio-decision-strip__context--muted">
            Closed {date}
            {pnlMoney ? ` · ${pnlMoney}` : ""}
          </p>
        </div>
        <div className="portfolio-decision-strip__center">
          <span className="portfolio-strip-badge portfolio-strip-badge--closed">Recorded</span>
          <div className={pnlCls}>{pnlStr}</div>
        </div>
        <div className="portfolio-decision-strip__right" />
      </div>
    </article>
  );
}

export default function PortfolioDecisionStrip({ item, onReview }: Props) {
  const tier = planTierFromAction(item.decision?.action);
  const pnl = item.meta?.pnlPct ?? 0;
  const pnlPos = pnl > 0;
  const pnlCls =
    pnlPos
      ? "portfolio-strip__pnl portfolio-strip__pnl--pos"
      : pnl < 0
        ? "portfolio-strip__pnl portfolio-strip__pnl--neg"
        : "portfolio-strip__pnl portfolio-strip__pnl--flat";
  const pnlStr = `${pnlPos ? "+" : ""}${pnl.toFixed(2)}%`;
  const qty = item.meta?.quantity;
  const entry = formatEntryInr(item.meta?.avgPricePaise);
  const entryLine =
    qty != null && Number.isFinite(qty) && qty > 0 ? `${entry} · ${qty}u` : entry;

  return (
    <article
      className={`portfolio-decision-strip portfolio-decision-strip--${tier}`}
      aria-label={`Position ${item.title}`}
    >
      <div className="portfolio-decision-strip__accent" aria-hidden />
      <div className="portfolio-decision-strip__body">
        <div className="portfolio-decision-strip__left">
          <div className="portfolio-decision-strip__symbol">{item.title}</div>
          <div className="portfolio-decision-strip__entry">{entryLine}</div>
          <p className="portfolio-decision-strip__context">{systemContextLine(tier)}</p>
        </div>
        <div className="portfolio-decision-strip__center">
          <span className={`portfolio-strip-badge portfolio-strip-badge--${tier}`}>
            {statusLabel(tier)}
          </span>
          <div className={pnlCls}>{pnlStr}</div>
        </div>
        <div className="portfolio-decision-strip__right">
          <button type="button" className="portfolio-strip__cta" onClick={onReview}>
            Review trade
          </button>
        </div>
      </div>
    </article>
  );
}
