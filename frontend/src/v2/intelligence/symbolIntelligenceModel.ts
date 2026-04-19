import type { NewsSignal } from "../hooks/useMarketNews";
import { mapSignalsToIntelligenceItems, type IntelligenceBias } from "../pages/markets/mapIntelligenceItems";
import { buildIntelligenceBullets } from "../pages/markets/buildIntelligenceBullets";

export function aggregateNewsBias(items: { bias: IntelligenceBias }[]): IntelligenceBias {
  const counts = { Bullish: 0, Bearish: 0, Neutral: 0 } as Record<IntelligenceBias, number>;
  for (const it of items) counts[it.bias] += 1;
  if (counts.Bullish > counts.Bearish && counts.Bullish >= counts.Neutral) return "Bullish";
  if (counts.Bearish > counts.Bullish && counts.Bearish >= counts.Neutral) return "Bearish";
  return "Neutral";
}

/** Single derivation path for news → sentiment + bullets (Markets + trade terminal). */
export function deriveNewsIntelligenceView(signals: NewsSignal[], bulletCap = 3) {
  const itemsForBias = mapSignalsToIntelligenceItems(signals, 8);
  const bullets = buildIntelligenceBullets(signals, bulletCap);
  const sentiment: IntelligenceBias =
    itemsForBias.length === 0 ? "Neutral" : aggregateNewsBias(itemsForBias);
  return { bullets, sentiment, itemsForBias };
}
