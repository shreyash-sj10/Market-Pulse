import { useMemo } from "react";
import { useMarketNews } from "../../../hooks/useMarketNews";
import { mapSignalsToIntelligenceItems, type IntelligenceBias } from "../mapIntelligenceItems";

const INTERNAL_INTEL_FALLBACK = (
  <>
    No major external signals are affecting this stock right now.
    <br />
    Decision is based on the internal model only.
  </>
);

function BiasTag({ bias }: { bias: IntelligenceBias }) {
  const cls =
    bias === "Bullish"
      ? "intel-block__bias intel-block__bias--bull"
      : bias === "Bearish"
        ? "intel-block__bias intel-block__bias--bear"
        : "intel-block__bias intel-block__bias--neutral";
  return <span className={cls}>{bias}</span>;
}

export type IntelligenceBlockProps = {
  symbol: string;
};

/** Curated intelligence (max 3) — not a raw news list. */
export default function IntelligenceBlock({ symbol }: IntelligenceBlockProps) {
  const { signals, isLoading, isError } = useMarketNews(symbol);

  const items = useMemo(() => mapSignalsToIntelligenceItems(signals, 3), [signals]);

  if (isLoading) {
    return <p className="workspace-flow-note">Loading intelligence…</p>;
  }
  if (isError || !items.length) {
    return <p className="workspace-flow-note workspace-flow-note--intel-fallback">{INTERNAL_INTEL_FALLBACK}</p>;
  }

  return (
    <ul className="intel-block__list">
      {items.map((it) => (
        <li key={it.id} className="intel-block__item">
          <div className="intel-block__top">
            <p className="intel-block__headline">{it.headline}</p>
            <BiasTag bias={it.bias} />
          </div>
          <p className="intel-block__impact">{it.impact}</p>
        </li>
      ))}
    </ul>
  );
}
