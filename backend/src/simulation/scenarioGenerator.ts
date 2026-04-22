import type { SimulationBehaviorTag, SimulationExitType, SimulationScenario } from "./types";

const DEFAULT_SYMBOLS = ["RELIANCE.NS", "TCS.NS", "INFY.NS", "HDFCBANK.NS", "ITC.NS"];

/** Canonical template entry (paise); runner rescales SL/TP/entry to live market. */
const TEMPLATE_ENTRY_PAISE = 5_000_000;

type TemplatePlan = {
  stopLoss: number;
  target: number;
  behaviorTag: SimulationBehaviorTag;
  exitType: SimulationExitType;
  reasoning: string;
};

const TEMPLATE_MIX: TemplatePlan[] = [
  {
    stopLoss: 4_850_000,
    target: 5_360_000,
    behaviorTag: "DISCIPLINED",
    exitType: "TARGET",
    reasoning: "Planned swing: structure + RR per playbook; taking target per plan.",
  },
  {
    stopLoss: 4_900_000,
    target: 5_220_000,
    behaviorTag: "DISCIPLINED",
    exitType: "TIME_EXIT",
    reasoning: "Session time-box: flatten before close regardless of tape.",
  },
  {
    stopLoss: 4_920_000,
    target: 5_180_000,
    behaviorTag: "NEUTRAL",
    exitType: "STOP_LOSS",
    reasoning: "Tight structure invalidation — exit if auction breaks support.",
  },
  {
    stopLoss: 4_880_000,
    target: 5_400_000,
    behaviorTag: "BAD_ENTRY",
    exitType: "STOP_LOSS",
    reasoning: "Chased extension; stop defines max adverse excursion.",
  },
  {
    stopLoss: 4_910_000,
    target: 5_250_000,
    behaviorTag: "EARLY_EXIT",
    exitType: "TIME_EXIT",
    reasoning: "Reduce risk after early strength; bank partial clarity.",
  },
  {
    stopLoss: 4_895_000,
    target: 5_280_000,
    behaviorTag: "REVENGE",
    exitType: "TARGET",
    reasoning: "Re-entry after recent loss on tape — forcing second chance.",
  },
  {
    stopLoss: 4_930_000,
    target: 5_200_000,
    behaviorTag: "STOP_CHASE",
    exitType: "STOP_LOSS",
    reasoning: "Widened stop after noise; process slip documented.",
  },
  {
    stopLoss: 4_860_000,
    target: 5_450_000,
    behaviorTag: "DISCIPLINED",
    exitType: "TARGET",
    reasoning: "High-conviction trend continuation; target at measured extension.",
  },
];

function pickSymbol(symbols: string[], index: number): string {
  const list = symbols.length ? symbols : DEFAULT_SYMBOLS;
  return list[index % list.length];
}

/**
 * Builds `tradeCount` scenarios with a fixed mix of behaviors and exit intents.
 * Prices are templates; the runner rescales them to the live quote per symbol.
 */
export function generateScenarios(tradeCount: number, symbols: string[]): SimulationScenario[] {
  const n = Math.max(1, Math.min(500, Math.round(tradeCount || 50)));
  const syms = symbols.length ? symbols : DEFAULT_SYMBOLS;
  const out: SimulationScenario[] = [];
  for (let i = 0; i < n; i += 1) {
    const tpl = TEMPLATE_MIX[i % TEMPLATE_MIX.length];
    const qty = 1 + (i % 3);
    out.push({
      symbol: pickSymbol(syms, i),
      entryPrice: TEMPLATE_ENTRY_PAISE,
      stopLoss: tpl.stopLoss,
      target: tpl.target,
      quantity: qty,
      reasoning: tpl.reasoning,
      behaviorTag: tpl.behaviorTag,
      exitType: tpl.exitType,
    });
  }
  return out;
}
