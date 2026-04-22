import { randomUUID } from "crypto";
import type {
  RunSimulationInput,
  RunSimulationResult,
  SimulationBehaviorTag,
  SimulationCredentials,
  SimulationScenario,
  SimulationStepResult,
} from "./types";
import { generateScenarios } from "./scenarioGenerator";

// Existing services only (CommonJS)
// eslint-disable-next-line @typescript-eslint/no-require-imports
const connectDB = require("../config/db");
// eslint-disable-next-line @typescript-eslint/no-require-imports
const User = require("../models/user.model");
// eslint-disable-next-line @typescript-eslint/no-require-imports
const preTradeGuard = require("../services/intelligence/preTradeGuard.service");
// eslint-disable-next-line @typescript-eslint/no-require-imports
const tradeService = require("../services/trade.service");
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { getPrice } = require("../services/price.engine");
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { validatePlan } = require("../services/risk.engine");
// eslint-disable-next-line @typescript-eslint/no-require-imports
const AppError = require("../utils/AppError");

const DEFAULT_TRADE_COUNT = 50;
const DEFAULT_SYMBOLS = ["RELIANCE.NS", "TCS.NS", "INFY.NS", "HDFCBANK.NS", "ITC.NS"];

function emotionForTag(tag: SimulationBehaviorTag): string {
  switch (tag) {
    case "DISCIPLINED":
      return "DISCIPLINED";
    case "REVENGE":
      return "REVENGE";
    case "EARLY_EXIT":
      return "ANXIOUS";
    case "BAD_ENTRY":
      return "FOMO";
    case "STOP_CHASE":
      return "FRUSTRATED";
    default:
      return "CALM";
  }
}

function scalePlan(anchorPaise: number, scenario: SimulationScenario) {
  const templ = scenario.entryPrice;
  const scale = anchorPaise / templ;
  const pricePaise = Math.round(anchorPaise);
  const stopLossPaise = Math.round(scenario.stopLoss * scale);
  const targetPricePaise = Math.round(scenario.target * scale);
  return { pricePaise, stopLossPaise, targetPricePaise };
}

function ensureValidBuyPlan(pricePaise: number, stopLossPaise: number, targetPricePaise: number) {
  const v = validatePlan({
    side: "BUY",
    pricePaise,
    stopLossPaise,
    targetPricePaise,
  });
  if (!v.isValid) {
    throw new Error(`SIMULATION_INVALID_PLAN:${v.errorCode || "UNKNOWN"}`);
  }
}

async function resolveUserDoc(credentials: SimulationCredentials) {
  const user = await User.findOne({ email: credentials.email }).select("+password");
  if (!user) {
    throw new Error("SIMULATION_USER_NOT_FOUND");
  }
  const ok = await user.comparePassword(credentials.password);
  if (!ok) {
    throw new Error("SIMULATION_AUTH_FAILED");
  }
  return User.findById(user._id);
}

function verdictAllowsExecution(verdict: string | null | undefined) {
  return verdict === "BUY";
}

async function settleIfPending(tradeId: string | undefined) {
  if (!tradeId) return;
  const TradeModel = require("../models/trade.model");
  const row = await TradeModel.findById(tradeId).select("status").lean();
  if (row?.status === "PENDING_EXECUTION") {
    await tradeService.executeOrder(tradeId);
  }
}

function buildThinking(scenario: SimulationScenario, phase: "ENTRY" | "EXIT") {
  const exitNote =
    phase === "EXIT"
      ? `Exit intent=${scenario.exitType}. Tag=${scenario.behaviorTag}.`
      : `Entry tag=${scenario.behaviorTag}.`;
  return `[SIMULATION] ${exitNote} ${scenario.reasoning}`.slice(0, 2000);
}

function errMessage(e: unknown) {
  if (e instanceof AppError) return e.message;
  if (e && typeof e === "object" && "message" in e) return String((e as { message: unknown }).message);
  return String(e);
}

/**
 * Runs N synthetic trades through the real pre-trade guard and trade service.
 * Tags rows with `manualTags: ["SIMULATION"]` and reason/userThinking prefixed with `[SIMULATION]`.
 *
 * Credentials: pass `credentials`, or set `SIMULATION_PASSWORD` (and optional `SIMULATION_EMAIL`) in the environment.
 */
export async function runSimulation(input: RunSimulationInput = {}): Promise<RunSimulationResult> {
  const tradeCount = input.tradeCount ?? DEFAULT_TRADE_COUNT;
  const symbols = input.symbols?.length ? input.symbols : DEFAULT_SYMBOLS;
  const email =
    input.credentials?.email ||
    process.env.SIMULATION_EMAIL ||
    "master.trader01@gmail.com";
  const password = input.credentials?.password || process.env.SIMULATION_PASSWORD;
  if (!password) {
    throw new Error(
      "SIMULATION_PASSWORD is not set (or pass credentials.password). Refusing to run without credentials."
    );
  }

  const credentials: SimulationCredentials = { email, password };
  const shouldConnect = input.connectDb !== false;

  if (shouldConnect) {
    await connectDB();
  }

  const user = await resolveUserDoc(credentials);
  if (!user) {
    throw new Error("SIMULATION_USER_MISSING");
  }

  const scenarios = generateScenarios(tradeCount, symbols);
  const steps: SimulationStepResult[] = [];
  let preTradeBuyBlocked = 0;
  let preTradeSellBlocked = 0;
  let partialCycles = 0;
  let buysCompleted = 0;
  let sellsCompleted = 0;
  let errors = 0;

  for (const scenario of scenarios) {
    const step: SimulationStepResult = {
      symbol: scenario.symbol,
      behaviorTag: scenario.behaviorTag,
      exitType: scenario.exitType,
      preTradeVerdict: null,
      buySkipped: false,
    };

    try {
      const quote = await getPrice(scenario.symbol);
      const anchor = quote.pricePaise;
      const { pricePaise, stopLossPaise, targetPricePaise } = scalePlan(anchor, scenario);
      ensureValidBuyPlan(pricePaise, stopLossPaise, targetPricePaise);

      const buyPre = await preTradeGuard.checkTradeRisk(
        {
          symbol: scenario.symbol,
          type: "BUY",
          quantity: scenario.quantity,
          pricePaise,
          stopLossPaise,
          targetPricePaise,
          productType: "DELIVERY",
          userThinking: buildThinking(scenario, "ENTRY"),
        },
        user
      );

      const buyVerdict = buyPre?.authority?.verdict ?? buyPre?.snapshot?.risk?.verdict ?? null;
      step.preTradeVerdict = buyVerdict;

      if (!verdictAllowsExecution(buyVerdict)) {
        step.buySkipped = true;
        step.buySkipReason = `PRE_TRADE_${buyVerdict || "UNKNOWN"}`;
        preTradeBuyBlocked += 1;
        steps.push(step);
        continue;
      }

      const buyToken = buyPre?.token || buyPre?.authority?.token;
      if (!buyToken) {
        step.buySkipped = true;
        step.buySkipReason = "MISSING_PRE_TRADE_TOKEN";
        preTradeBuyBlocked += 1;
        steps.push(step);
        continue;
      }

      const buyRequestId = randomUUID();
      const buyRes = await tradeService.executeBuyTrade(user, {
        symbol: scenario.symbol,
        side: "BUY",
        pricePaise,
        stopLossPaise,
        targetPricePaise,
        quantity: scenario.quantity,
        productType: "DELIVERY",
        preTradeEmotion: emotionForTag(scenario.behaviorTag),
        preTradeToken: buyToken,
        token: buyToken,
        requestId: buyRequestId,
        userThinking: buildThinking(scenario, "ENTRY"),
        reason: `[SIMULATION] ${scenario.reasoning}`,
        manualTags: ["SIMULATION"],
      });

      const buyId = buyRes?.trade?.tradeId;
      step.buyTradeId = buyId;
      await settleIfPending(buyId);
      buysCompleted += 1;

      const sellQuote = await getPrice(scenario.symbol);
      const sellPrice = sellQuote.pricePaise;

      const sellPre = await preTradeGuard.checkTradeRisk(
        {
          symbol: scenario.symbol,
          type: "SELL",
          quantity: scenario.quantity,
          pricePaise: sellPrice,
          productType: "DELIVERY",
          userThinking: buildThinking(scenario, "EXIT"),
        },
        user
      );

      const sellVerdict = sellPre?.authority?.verdict ?? sellPre?.snapshot?.risk?.verdict ?? null;
      if (!verdictAllowsExecution(sellVerdict)) {
        step.sellSkipped = true;
        step.sellSkipReason = `PRE_TRADE_${sellVerdict || "UNKNOWN"}`;
        preTradeSellBlocked += 1;
        partialCycles += 1;
        steps.push(step);
        continue;
      }

      const sellToken = sellPre?.token || sellPre?.authority?.token;
      if (!sellToken) {
        step.sellSkipped = true;
        step.sellSkipReason = "MISSING_PRE_TRADE_TOKEN";
        preTradeSellBlocked += 1;
        partialCycles += 1;
        steps.push(step);
        continue;
      }

      const sellRequestId = randomUUID();
      const sellRes = await tradeService.executeSellTrade(user, {
        symbol: scenario.symbol,
        side: "SELL",
        pricePaise: sellPrice,
        quantity: scenario.quantity,
        productType: "DELIVERY",
        preTradeEmotion: emotionForTag(scenario.behaviorTag),
        preTradeToken: sellToken,
        token: sellToken,
        requestId: sellRequestId,
        userThinking: buildThinking(scenario, "EXIT"),
        reason: `[SIMULATION] exit=${scenario.exitType}`,
        manualTags: ["SIMULATION"],
      });

      const sellId = sellRes?.trade?.tradeId;
      step.sellTradeId = sellId;
      await settleIfPending(sellId);
      sellsCompleted += 1;
    } catch (e) {
      errors += 1;
      step.error = errMessage(e);
      if (step.buyTradeId && !step.sellTradeId) {
        partialCycles += 1;
      }
      steps.push(step);
      continue;
    }

    steps.push(step);
  }

  return {
    requested: scenarios.length,
    symbols,
    steps,
    summary: {
      preTradeBuyBlocked,
      preTradeSellBlocked,
      partialCycles,
      buysCompleted,
      sellsCompleted,
      errors,
    },
  };
}
