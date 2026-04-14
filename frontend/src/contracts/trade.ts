import type { AIResponse } from "./ai";

export type TraceStep = {
  stage: string;
  timestamp: string;
  metadata: any;
};

export type DecisionSnapshot = {
  verdict: string;
  score: number;
  pillars?: {
    market?: any;
    behavior?: any;
    risk?: any;
    rr?: any;
  };
  warnings?: string[];
};

export type TradeExtended = {
  tradeId: string | null;
  symbol: string | null;
  side: "BUY" | "SELL" | null;
  pricePaise: number;
  stopLossPaise: number | null;
  targetPricePaise: number | null;
  quantity: number;
  pnlPct: number;
  status: string;
  decisionSnapshot: DecisionSnapshot | null;
  trace: {
    timeline: TraceStep[];
  } | null;
  ai: AIResponse | null;
};
