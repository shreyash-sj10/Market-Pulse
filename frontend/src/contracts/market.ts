import type { AIResponse } from "./ai";

export type MarketQuote = {
  symbol: string;
  pricePaise: number;
  source: "REAL" | "CACHE" | "FALLBACK";
  isFallback: boolean;
};

export type MarketNews = {
  title: string;
  ai: AIResponse;
};

export type MarketOverview = {
  quotes: MarketQuote[];
  news: MarketNews[];
};
