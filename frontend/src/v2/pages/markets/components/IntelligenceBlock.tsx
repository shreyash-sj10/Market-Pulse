import { useSymbolIntelligence } from "../../../hooks/useSymbolIntelligence";
import type { IntelligenceBias } from "../mapIntelligenceItems";

export type IntelligenceTapeContext = {
  trend: string;
  changePercent: number;
  isDegradedTape: boolean;
};

function BiasTag({ bias }: { bias: IntelligenceBias }) {
  const cls =
    bias === "Bullish"
      ? "intel-strip__bias intel-strip__bias--bull"
      : bias === "Bearish"
        ? "intel-strip__bias intel-strip__bias--bear"
        : "intel-strip__bias intel-strip__bias--neutral";
  return <span className={cls}>{bias}</span>;
}

export type IntelligenceBlockProps = {
  symbol: string;
  /** @deprecated kept for call-site compatibility; news-only UI ignores tape */
  tapeContext?: IntelligenceTapeContext;
};

const NO_NEWS_COPY = "No relevant news impacting this stock";

/** News-driven sentiment + 2–3 bullets; no tape fallback when headlines are absent. */
export default function IntelligenceBlock({ symbol }: IntelligenceBlockProps) {
  const { bullets, sentiment, isLoading, isError } = useSymbolIntelligence(symbol);

  if (isLoading) {
    return <p className="intel-strip__state">Loading intelligence…</p>;
  }

  if (bullets.length > 0) {
    return (
      <div className="intel-strip intel-strip--rich">
        <div className="intel-strip__row">
          <span className="intel-strip__k">Sentiment</span>
          <BiasTag bias={sentiment} />
        </div>
        <ul className="intel-bullet-list">
          {bullets.map((line, i) => (
            <li key={`${i}-${line.slice(0, 32)}`} className="intel-bullet-list__item">
              {line}
            </li>
          ))}
        </ul>
      </div>
    );
  }

  return (
    <div className="intel-strip intel-strip--rich">
      <div className="intel-strip__row">
        <span className="intel-strip__k">Sentiment</span>
        <BiasTag bias={isError ? "Neutral" : sentiment} />
      </div>
      <p className="intel-strip__empty">{NO_NEWS_COPY}</p>
    </div>
  );
}
