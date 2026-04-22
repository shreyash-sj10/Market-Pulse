/**
 * Simulation / replay domain types.
 * Trades are tagged via `manualTags: ["SIMULATION"]` (no `source` field on Trade schema).
 */

export type SimulationExitType = "TARGET" | "STOP_LOSS" | "TIME_EXIT";

export type SimulationBehaviorTag =
  | "DISCIPLINED"
  | "REVENGE"
  | "EARLY_EXIT"
  | "BAD_ENTRY"
  | "STOP_CHASE"
  | "NEUTRAL";

export interface SimulationScenario {
  symbol: string;
  /** Template entry in paise; runner rescales to live quote. */
  entryPrice: number;
  stopLoss: number;
  target: number;
  quantity: number;
  reasoning: string;
  behaviorTag: SimulationBehaviorTag;
  exitType: SimulationExitType;
}

export interface SimulationCredentials {
  email: string;
  password: string;
}

export interface RunSimulationInput {
  tradeCount?: number;
  symbols?: string[];
  /** Required unless set in env (see simulationRunner). */
  credentials?: SimulationCredentials;
  /** If false, caller must have connected Mongoose already. */
  connectDb?: boolean;
}

export interface SimulationStepResult {
  symbol: string;
  behaviorTag: SimulationBehaviorTag;
  exitType: SimulationExitType;
  preTradeVerdict: string | null;
  buySkipped: boolean;
  buySkipReason?: string;
  buyTradeId?: string;
  sellSkipped?: boolean;
  sellSkipReason?: string;
  sellTradeId?: string;
  error?: string;
}

export interface RunSimulationResult {
  requested: number;
  symbols: string[];
  steps: SimulationStepResult[];
  summary: {
    /** Buy-side pre-trade returned WAIT/AVOID (or missing token). */
    preTradeBuyBlocked: number;
    /** Sell-side pre-trade blocked after a buy had already filled. */
    preTradeSellBlocked: number;
    /** Buy filled but sell did not (blocked pre-trade or thrown error). */
    partialCycles: number;
    buysCompleted: number;
    sellsCompleted: number;
    errors: number;
  };
}
