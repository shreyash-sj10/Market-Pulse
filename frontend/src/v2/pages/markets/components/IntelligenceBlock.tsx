import { useMemo } from "react";
import { useMarketNews } from "../../../hooks/useMarketNews";
import { mapSignalsToIntelligenceItems, type IntelligenceBias } from "../mapIntelligenceItems";

export type IntelligenceTapeContext = {
  trend: string;
  changePercent: number;
  isDegradedTape: boolean;
};

function biasFromTrend(trend: string): IntelligenceBias {
  const t = String(trend).toUpperCase();
  if (t === "BULLISH") return "Bullish";
  if (t === "BEARISH") return "Bearish";
  return "Neutral";
}

function BiasTag({ bias }: { bias: IntelligenceBias }) {
  const cls =
    bias === "Bullish"
      ? "intel-strip__bias intel-strip__bias--bull"
      : bias === "Bearish"
        ? "intel-strip__bias intel-strip__bias--bear"
        : "intel-strip__bias intel-strip__bias--neutral";
  return <span className={cls}>{bias}</span>;
}

function aggregateBias(items: { bias: IntelligenceBias }[]): IntelligenceBias {
  const counts = { Bullish: 0, Bearish: 0, Neutral: 0 } as Record<IntelligenceBias, number>;
  for (const it of items) counts[it.bias] += 1;
  if (counts.Bullish > counts.Bearish && counts.Bullish >= counts.Neutral) return "Bullish";
  if (counts.Bearish > counts.Bullish && counts.Bearish >= counts.Neutral) return "Bearish";
  return "Neutral";
}

export type IntelligenceBlockProps = {
  symbol: string;
  tapeContext: IntelligenceTapeContext;
};

/** News-derived sentiment plus one-line readout; falls back to tape when the feed is empty. */
export default function IntelligenceBlock({ symbol, tapeContext }: IntelligenceBlockProps) {
  const { signals, isLoading, isError } = useMarketNews(symbol);

  const items = useMemo(() => mapSignalsToIntelligenceItems(signals, 3), [signals]);

  const fallback = useMemo(() => {
    const bias = biasFromTrend(tapeContext.trend);
    const chg = tapeContext.changePercent;
    const chgStr = `${chg > 0 ? "+" : ""}${chg.toFixed(2)}%`;
    const expl = tapeContext.isDegradedTape
      ? `Quotes are degraded (${chgStr} session). No ranked headlines — lean on tape, engine posture, and risk limits.`
      : `No ranked headlines in the current window (${chgStr} session). Readout follows live trend and flow only.`;
    return { bias, expl };
  }, [tapeContext.trend, tapeContext.changePercent, tapeContext.isDegradedTape]);

  if (isLoading) {
    return <p className="intel-strip__state">Loading intelligence…</p>;
  }

  if (!isError && items.length > 0) {
    const bias = aggregateBias(items);
    const expl = items[0].impact.trim() || items[0].headline;
    return (
      <div className="intel-strip">
        <div className="intel-strip__row">
          <span className="intel-strip__k">Sentiment</span>
          <BiasTag bias={bias} />
        </div>
        <p className="intel-strip__expl">{expl}</p>
      </div>
    );
  }

  return (
    <div className="intel-strip">
      <div className="intel-strip__row">
        <span className="intel-strip__k">Sentiment</span>
        <BiasTag bias={fallback.bias} />
      </div>
      <p className="intel-strip__expl">{fallback.expl}</p>
    </div>
  );
}
