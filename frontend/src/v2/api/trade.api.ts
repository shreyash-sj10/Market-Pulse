import api from "./api.js";

export interface PreTradeParams {
  side: "BUY" | "SELL";
  productType?: "DELIVERY" | "INTRADAY";
  symbol: string;
  quantity: number;
  pricePaise: number;
  stopLossPaise?: number;
  targetPricePaise?: number;
  userThinking?: string;
  /** Optional at evaluate — forwarded when set for richer behaviour context. */
  preTradeEmotion?: string;
}

export interface PreTradeResult {
  success: boolean;
  state: string;
  data: {
    token: string;
    expiresAt: number;
    snapshot: {
      market: {
        direction: string | null;
        confidence: number | null;
        alignment: string;
        status: string;
      };
      pillars: {
        marketAlignment:    { score: number | null; status: string; reasoning: string };
        sectorCorrelation:  { score: number | null; status: string; reasoning: string };
        behavioralRisk:     { score: number | null; status: string; reasoning: string };
        rrQuality:          { score: number | null; status: string; reasoning: string };
      };
      behavior: { flags: string[]; sensitivityLevel: string; disciplineScore: number };
      risk: { score: number; rr: number; verdict: string; level: string; status: string; reason: string };
    };
    authority: { token: string; expiresAt: number; verdict: string };
    /** Present when API uses slim rollups alongside full `snapshot`. */
    summary?: { riskScore: number; warnings: string[]; signals: string[] };
  };
}

export interface ExecuteTradeParams {
  side: "BUY" | "SELL";
  productType?: "DELIVERY" | "INTRADAY";
  symbol: string;
  quantity: number;
  pricePaise: number;
  stopLossPaise?: number;
  targetPricePaise?: number;
  preTradeToken: string;
  decisionContext?: Record<string, unknown>;
  /** Recorded on the trade / trace path (optional but recommended). */
  userThinking?: string;
  /** Required at execution — persisted for behavioural analytics. */
  preTradeEmotion: string;
  /** Stable per user action; retries MUST reuse the same key until a terminal response. */
  idempotencyKey?: string;
}

export interface ExecuteTradeResult {
  success: boolean;
  state: string;
  data: {
    tradeId?: string | null;
    symbol: string;
    side: string;
    productType?: "DELIVERY" | "INTRADAY";
    quantity: number;
    pricePaise: number;
    executionPricePaise?: number;
    totalValuePaise?: number;
    status: string;
    updatedBalance?: number;
    executionBalance?: number;
    currentBalance?: number;
    reflectionStatus?: string | null;
  };
  meta?: {
    systemStateVersion?: number;
    /** Present when replay used trade fallback — balances may diverge. */
    replayApproximateBalance?: boolean;
    traceId?: string;
  };
}

/** Step 1: Request a pre-trade risk analysis + get an authority token */
export async function runPreTrade(params: PreTradeParams): Promise<PreTradeResult> {
  const body: Record<string, unknown> = {
    side:         params.side,
    productType:  params.productType ?? "DELIVERY",
    symbol:       params.symbol,
    quantity:     params.quantity,
    pricePaise:   params.pricePaise,
    userThinking: params.userThinking || "Trade initiated via NOESIS decision panel",
  };

  if (params.side === "BUY") {
    body.stopLossPaise     = params.stopLossPaise;
    body.targetPricePaise  = params.targetPricePaise;
  }
  if (params.preTradeEmotion) {
    body.preTradeEmotion = params.preTradeEmotion;
  }

  const res = await api.post("/intelligence/pre-trade", body);
  return res.data as PreTradeResult;
}

/** Step 2: Execute the trade after pre-trade approval */
export async function executeTrade(params: ExecuteTradeParams): Promise<ExecuteTradeResult> {
  const idempotencyKey = params.idempotencyKey ?? crypto.randomUUID();
  const route = params.side === "BUY" ? "/trades/buy" : "/trades/sell";

  const body: Record<string, unknown> = {
    side:            params.side,
    productType:     params.productType ?? "DELIVERY",
    symbol:          params.symbol,
    quantity:        params.quantity,
    pricePaise:      params.pricePaise,
    preTradeToken:   params.preTradeToken,
    decisionContext: params.decisionContext ?? { source: "NOESIS_PANEL", version: "v2" },
    userThinking:
      params.userThinking?.trim() || "Trade confirmed via NOESIS execution workspace",
    preTradeEmotion: params.preTradeEmotion,
  };

  if (params.side === "BUY") {
    body.stopLossPaise    = params.stopLossPaise;
    body.targetPricePaise = params.targetPricePaise;
  }

  const res = await api.post(route, body, {
    headers: {
      "idempotency-key":  idempotencyKey,
      "pre-trade-token":  params.preTradeToken,
    },
  });
  return res.data as ExecuteTradeResult;
}

/** Poll async execution / reflection pipeline status (additive observability). */
export async function getTradeExecutionStatus(tradeId: string) {
  const res = await api.get(`/trades/execution-status/${tradeId}`);
  return res.data as {
    success: boolean;
    data: {
      tradeId: string;
      tradeStatus: string;
      reflectionStatus: string | null;
      executionDerivedStatus: string;
      outboxJobs: Array<{
        id: string;
        type: string;
        status: string;
        attempts: number;
        maxAttempts: number;
        lastError: string | null;
        updatedAt?: string;
        processingStartedAt?: string | null;
      }>;
    };
    meta?: { traceId?: string; lastUpdated?: string };
  };
}
