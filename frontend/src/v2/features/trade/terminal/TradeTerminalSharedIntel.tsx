import type { IntelligenceBias } from "../../../pages/markets/mapIntelligenceItems";

function BiasTag({ bias }: { bias: IntelligenceBias }) {
  const cls =
    bias === "Bullish"
      ? "intel-strip__bias intel-strip__bias--bull"
      : bias === "Bearish"
        ? "intel-strip__bias intel-strip__bias--bear"
        : "intel-strip__bias intel-strip__bias--neutral";
  return <span className={cls}>{bias}</span>;
}

const NO_NEWS = "No relevant news impacting this stock";

/** Same `useSymbolIntelligence` output styling as Markets workspace — single narrative. */
export default function TradeTerminalSharedIntel({
  isLoading,
  isError,
  sentiment,
  bullets,
}: {
  isLoading: boolean;
  isError: boolean;
  sentiment: IntelligenceBias;
  bullets: string[];
}) {
  if (isLoading) {
    return (
      <section className="trade-terminal-section" aria-label="News intelligence">
        <p className="trade-terminal-kicker">Intelligence (shared)</p>
        <p className="trade-terminal-note trade-terminal-note--muted">Loading headlines…</p>
      </section>
    );
  }

  if (bullets.length > 0) {
    return (
      <section className="trade-terminal-section" aria-label="News intelligence">
        <p className="trade-terminal-kicker">Intelligence (shared)</p>
        <div className="intel-strip intel-strip--rich trade-terminal-intel-strip">
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
      </section>
    );
  }

  return (
    <section className="trade-terminal-section" aria-label="News intelligence">
      <p className="trade-terminal-kicker">Intelligence (shared)</p>
      <div className="intel-strip intel-strip--rich trade-terminal-intel-strip">
        <div className="intel-strip__row">
          <span className="intel-strip__k">Sentiment</span>
          <BiasTag bias={isError ? "Neutral" : sentiment} />
        </div>
        <p className="intel-strip__empty">{NO_NEWS}</p>
      </div>
    </section>
  );
}
