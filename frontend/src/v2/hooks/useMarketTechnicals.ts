import { useQuery } from "@tanstack/react-query";
import api from "../api/api.js";
import { queryKeys } from "../queryKeys";

export type MarketTechnicals = {
  rsi14: number | null;
  ema200VsPrice: "above" | "below" | null;
  volumeVsAvgLabel: string | null;
  sampleSize: number;
  isDegraded: boolean;
};

type HistoryBar = {
  closePaise?: number;
  volume?: number;
};

function num(x: unknown): number | null {
  const n = Number(x);
  return Number.isFinite(n) ? n : null;
}

/** Wilder RSI on close series (prices in any consistent unit). */
export function computeRsi14(closes: number[]): number | null {
  const n = 14;
  if (closes.length < n + 1) return null;
  const changes: number[] = [];
  for (let i = 1; i < closes.length; i += 1) {
    changes.push(closes[i] - closes[i - 1]);
  }
  let avgGain = 0;
  let avgLoss = 0;
  for (let i = 0; i < n; i += 1) {
    const c = changes[i];
    if (c > 0) avgGain += c;
    else avgLoss -= c;
  }
  avgGain /= n;
  avgLoss /= n;
  for (let i = n; i < changes.length; i += 1) {
    const c = changes[i];
    const g = c > 0 ? c : 0;
    const l = c < 0 ? -c : 0;
    avgGain = (avgGain * (n - 1) + g) / n;
    avgLoss = (avgLoss * (n - 1) + l) / n;
  }
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
}

function mean(xs: number[]): number {
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

/** EMA(span) seeded with SMA of first `span` closes; returns last EMA value. */
export function computeEmaLast(closes: number[], span: number): number | null {
  if (closes.length < span) return null;
  const k = 2 / (span + 1);
  let ema = mean(closes.slice(0, span));
  for (let i = span; i < closes.length; i += 1) {
    ema = closes[i] * k + ema * (1 - k);
  }
  return ema;
}

function buildTechnicalsFromBars(prices: HistoryBar[], isFallback: boolean): MarketTechnicals {
  const closes = prices
    .map((p) => num(p.closePaise))
    .filter((v): v is number => v != null && v > 0);
  const vols = prices.map((p) => num(p.volume)).filter((v): v is number => v != null && v >= 0);

  const rsi14 = computeRsi14(closes);
  const ema200 = computeEmaLast(closes, 200);
  const lastClose = closes.length ? closes[closes.length - 1] : null;
  let ema200VsPrice: "above" | "below" | null = null;
  if (ema200 != null && lastClose != null) {
    ema200VsPrice = lastClose >= ema200 ? "above" : "below";
  }

  let volumeVsAvgLabel: string | null = null;
  if (vols.length >= 2) {
    const lastVol = vols[vols.length - 1];
    const window = vols.slice(Math.max(0, vols.length - 21), vols.length - 1);
    if (window.length > 0) {
      const avg = mean(window);
      if (avg > 0) {
        const ratio = lastVol / avg;
        volumeVsAvgLabel = `${ratio >= 1 ? "Above" : "Below"} ${Math.round(ratio * 100)}% of 20d avg volume`;
      }
    }
  }

  return {
    rsi14: rsi14 != null ? Math.round(rsi14 * 10) / 10 : null,
    ema200VsPrice,
    volumeVsAvgLabel,
    sampleSize: closes.length,
    isDegraded: isFallback || closes.length < 60,
  };
}

async function fetchTechnicals(symbol: string): Promise<MarketTechnicals> {
  const res = await api.get(`/market/history?symbol=${encodeURIComponent(symbol)}&period=1y`);
  const body = res?.data as { data?: { prices?: HistoryBar[]; isFallback?: boolean } };
  const prices = Array.isArray(body?.data?.prices) ? body.data!.prices! : [];
  const isFallback = Boolean(body?.data?.isFallback);
  if (!prices.length) {
    return {
      rsi14: null,
      ema200VsPrice: null,
      volumeVsAvgLabel: null,
      sampleSize: 0,
      isDegraded: true,
    };
  }
  return buildTechnicalsFromBars(prices, isFallback);
}

export function useMarketTechnicals(symbol: string | null) {
  const q = useQuery({
    queryKey: queryKeys.marketTechnicals(symbol ?? ""),
    queryFn: () => fetchTechnicals(symbol!),
    enabled: Boolean(symbol),
    staleTime: 120_000,
    retry: 1,
  });

  return {
    technicals: q.data ?? null,
    isLoading: q.isPending,
    isError: q.isError,
  };
}
