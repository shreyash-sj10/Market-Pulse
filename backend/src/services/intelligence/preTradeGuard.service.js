const newsEngine = require("../news/news.engine");
const Trade = require("../../models/trade.model");
const adaptiveEngine = require("./adaptiveEngine.service");
const { parseTradeIntent, generateFinalTradeCall } = require("../aiExplanation.service");
const { validateStrategy } = require("../strategy.engine");
const { issueDecisionToken } = require("./preTradeAuthority.store");
const { toHoldingsObject } = require("../../utils/holdingsNormalizer");
const Holding = require("../../models/holding.model");
const {
  evaluateEntryDecision,
  mapDecisionVerdictToAuthorityVerdict,
} = require("../../engines/entry.engine");
const { isValidStatus } = require("../../constants/intelligenceStatus");
const { SYSTEM_CONFIG } = require("../../config/system.config");
const logger = require("../../lib/logger");

/**
 * PRE-TRADE DECISION SNAPSHOT ENGINE
 */
const getBehavioralFlags = async (user) => {
  const cfg = SYSTEM_CONFIG.intelligence.preTrade;
  const lastTrades = await Trade.find({ user: user._id }).sort({ createdAt: -1 }).limit(5);
  const flags = [];
  
  if (lastTrades.length > 0) {
    const last = lastTrades[0];
    if (last.pnlPaise < 0 && (Date.now() - new Date(last.createdAt).getTime() < cfg.revengeWindowMs)) {
      flags.push("REVENGE_TRADING_RISK");
    }
  }
  return flags;
};

const checkTradeRisk = async (tradeRequest, user) => {
  const cfg = SYSTEM_CONFIG.intelligence.preTrade;
  const { 
    symbol, type, quantity, userThinking, pricePaise, stopLossPaise, targetPricePaise,
  } = tradeRequest;
  const finalPrice = Math.round(Number(pricePaise || 0));
  const finalSL = stopLossPaise === undefined || stopLossPaise === null ? null : Math.round(Number(stopLossPaise));
  const finalTP = targetPricePaise === undefined || targetPricePaise === null ? null : Math.round(Number(targetPricePaise));


  // LAYER 1: MARKET INTELLIGENCE
  const holdingDocs = await Holding.find({ userId: user._id });
  const holdings = toHoldingsObject(holdingDocs.map((holding) => ({
    symbol: holding.symbol,
    quantity: holding.quantity,
    avgPricePaise: holding.avgPricePaise,
  })));
  const newsResponse = await newsEngine.getProcessedNews(symbol, holdings);
  const consensus = newsResponse.signals?.[0];
  const marketStatus = newsResponse?.status || (consensus ? "VALID" : "UNAVAILABLE");

  // LAYER 2: TRADE SETUP (AI Intent + Strategy Rule)
  const parsedIntent = await parseTradeIntent(userThinking);
  const parsedIntentValid = isValidStatus(parsedIntent);
  const strategyAudit = parsedIntentValid
    ? validateStrategy(parsedIntent, {
      rsi: Number(consensus?.rsi),
      trend: consensus?.verdict === "BUY" ? "BULLISH" : "BEARISH",
      volatility: Number(consensus?.volatility),
    })
    : { isValid: false, mismatchReason: parsedIntent?.reason || "INSUFFICIENT_INTENT_DATA", score: null };

  // LAYER 3: BEHAVIORAL ANALYSIS
  const behavioralFlags = await getBehavioralFlags(user);
  const adaptiveProfile = await adaptiveEngine.getAdaptiveProfile(user._id);

  // LAYER 4: ENTRY ENGINE (Decision ownership)
  const entryDecisionBase = evaluateEntryDecision({
    plan: {
      side: type || "BUY",
      pricePaise: finalPrice,
      stopLossPaise: finalSL,
      targetPricePaise: finalTP,
    },
    marketContext: {
      status: marketStatus,
      consensusVerdict: consensus?.verdict,
      strategyValid: strategyAudit.isValid,
    },
    behaviorContext: {
      status: "VALID",
      flags: behavioralFlags,
    },
  });

  const initialInsight = {
    riskLevel: entryDecisionBase.baseRiskImpact > cfg.highRiskBoundary ? "HIGH" : "MEDIUM",
    reasoning: ["Standard protocol audit."],
  };
  const adapted = await adaptiveEngine.adaptWarning(initialInsight, adaptiveProfile);

  const entryDecision = evaluateEntryDecision({
    plan: {
      side: type || "BUY",
      pricePaise: finalPrice,
      stopLossPaise: finalSL,
      targetPricePaise: finalTP,
    },
    marketContext: {
      status: marketStatus,
      consensusVerdict: consensus?.verdict,
      strategyValid: strategyAudit.isValid,
      adaptedRiskLevel: adapted.adaptedRiskLevel,
    },
    behaviorContext: {
      status: "VALID",
      flags: behavioralFlags,
    },
  });

  if (type === "BUY" && entryDecision.planValidation && !entryDecision.planValidation.isValid) {
    throw new Error(entryDecision.planValidation.errorCode);
  }

  const rr = type === "BUY" ? entryDecision.rr : 0;
  const finalScore = entryDecision.riskScore;
  const verdict = mapDecisionVerdictToAuthorityVerdict(entryDecision.verdict);

  const aiDecision = await generateFinalTradeCall({
     market: { direction: consensus?.verdict, confidence: consensus?.confidence, reason: consensus?.judgment },
     setup: { 
       type: parsedIntentValid ? parsedIntent.strategy : "UNAVAILABLE",
       score: strategyAudit.isValid ? cfg.setupValidScore : cfg.setupInvalidScore, 
       reason: `${strategyAudit.mismatchReason || "Protocol alignment confirmed."} R:R Ratio: ${rr}.` 
     },
     behavior: { 
       risk: adapted.adaptedRiskLevel, 
       score: 100 - (behavioralFlags.length * cfg.behavioralScorePenaltyPerFlag), 
       reason: adapted.adaptiveMessage 
     },
     risk: { level: verdict === "BUY" ? "LOW" : "HIGH", score: finalScore, reason: "Multiple factor adaptive risk audit complete." },
     finalScore
  }, { verdict });

  const authority = await issueDecisionToken({
    symbol,
    pricePaise: finalPrice,
    quantity,
    stopLossPaise: finalSL,
    targetPricePaise: finalTP,
    verdict,
    userId: user._id,
  });

  logger.info({
    action: "PRE_TRADE_AUDIT",
    userId: user._id,
    symbol,
    verdict,
    score: finalScore,
    status: "SUCCESS"
  });



  // CONSTRUCT THE SNAPSHOT
  return {
    success: true,
    token: authority.token,
    expiresAt: authority.expiresAt,
    snapshot: {
       market: {
          direction: consensus?.verdict ?? null,
          impact: consensus?.impact ?? null,
          mechanism: consensus?.mechanism ?? null,
          confidence: consensus?.confidence ?? null,
          alignment: consensus?.verdict === type ? "OPTIMAL" : "DIVERGENT",
          sector: consensus?.sector || "GENERAL",
          status: marketStatus,
          reason: marketStatus === "UNAVAILABLE" ? (newsResponse?.reason || "NO_MARKET_SIGNALS") : undefined,
       },
       pillars: {
          marketAlignment: {
             score: consensus?.verdict === type ? cfg.alignedScore : cfg.conflictedScore,
             status: consensus?.verdict === type ? "ALIGNED" : "CONFLICTED",
             reasoning: marketStatus === "UNAVAILABLE"
               ? "Data not available. Decision limited due to missing signals."
               : `Market consensus for ${symbol} is ${consensus?.verdict}. Entry ${type} is ${consensus?.verdict === type ? "synchronous" : "opposing"} with live intelligence.`
          },
          sectorCorrelation: {
             score: Number.isFinite(Number(consensus?.confidence))
               ? (consensus?.confidence > cfg.sectorStrongConfidence ? cfg.sectorStrongScore : cfg.sectorNeutralScore)
               : null,
             status: Number.isFinite(Number(consensus?.confidence))
               ? (consensus?.confidence > cfg.sectorStrongConfidence ? "STRONG" : "NEUTRAL")
               : "UNAVAILABLE",
             reasoning: Number.isFinite(Number(consensus?.confidence))
               ? `${consensus?.sector || "Sector"} signals are ${consensus?.confidence > cfg.sectorStrongConfidence ? "reinforcing" : "neutral"} regarding the current market action.`
               : "Data not available. Decision limited due to missing signals."
          },
          volumeSetupStrength: {
             score: strategyAudit.isValid ? cfg.setupValidScore : cfg.setupInvalidScore,
             status: strategyAudit.isValid ? "ROBUST" : "FRAGILE",
             reasoning: strategyAudit.isValid ? "Technical volume profile and setup align with institutional strategy protocols." : strategyAudit.mismatchReason
          },
          behavioralRisk: {
             score: 100 - (behavioralFlags.length * cfg.behavioralDisciplinePenaltyPerFlag),
             status: behavioralFlags.length === 0 ? "DISCIPLINED" : "COMPROMISED",
             reasoning: behavioralFlags.length === 0 ? "No active behavioral biases detected." : `Detected: ${behavioralFlags.join(", ").replace(/_/g, " ")}. Emotional friction is high.`
          },
          rrQuality: {
             score: rr >= cfg.optimalRrThreshold ? cfg.rrOptimalScore : rr >= cfg.lowRrThreshold ? cfg.rrAcceptableScore : cfg.rrPoorScore,
             status: rr >= cfg.optimalRrThreshold ? "OPTIMAL" : rr >= cfg.lowRrThreshold ? "ACCEPTABLE" : "POOR",
             reasoning: `Reward-to-Risk ratio of ${rr} ${rr >= cfg.lowRrThreshold ? "meets" : "fails"} professional capital preservation standards.`
          }
       },
       setup: {
          strategy: parsedIntentValid ? parsedIntent.strategy : null,
          isValid: strategyAudit.isValid,
          reason: strategyAudit.mismatchReason,
          confidence: parsedIntentValid ? parsedIntent.confidence : null,
          status: parsedIntentValid ? "VALID" : "UNAVAILABLE",
          unavailableReason: parsedIntentValid ? undefined : parsedIntent?.reason,
       },
       behavior: {
          flags: behavioralFlags,
          sensitivity: adaptiveProfile.sensitivityLevel,
          disciplineScore: 100 - (behavioralFlags.length * cfg.behavioralDisciplinePenaltyPerFlag)
       },
       risk: {
          score: finalScore,
          rr,
          verdict,
          level: verdict === "BUY" ? "OPTIMAL" : verdict === "WAIT" ? "CAUTION" : "EXTREME",
          status: entryDecision.status || "VALID",
          reason: entryDecision.reason,
       },
       verdict: aiDecision
    },
    authority: {
      token: authority.token,
      expiresAt: authority.expiresAt,
      verdict,
    },
  };
};

module.exports = { checkTradeRisk };
