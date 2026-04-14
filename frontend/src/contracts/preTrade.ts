import type { AIResponse } from "./ai";

export type PreTradeSnapshot = {
  riskScore: number;
  warnings: string[];
  signals: string[];
};

export type PreTradeResponse = {
  allowed: boolean;
  token: string | null;
  snapshot: PreTradeSnapshot;
  ai: AIResponse;
};
