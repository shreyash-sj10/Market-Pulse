const newsEngine = require("../news/news.engine");
const Trade = require("../../models/trade.model");
const adaptiveEngine = require("./adaptiveEngine.service");
const { parseTradeIntent, generateExplanation, generateFinalTradeCall } = require("../aiExplanation.service");
const { validateStrategy } = require("../strategy.engine");
const { issueDecisionToken } = require("./preTradeAuthority.store");
const { toHoldingsObject } = require("../../utils/holdingsNormalizer");
const logger = require("../../lib/logger");

/**
 * PRE-TRADE DECISION SNAPSHOT ENGINE
 */
const getBehavioralFlags = async (user) => {

  const lastTrades = await Trade.find({ user: user._id }).sort({ createdAt: -1 }).limit(5);
  const flags = [];
  
  if (lastTrades.length > 0) {
    const last = lastTrades[0];
    if (last.pnl < 0 && (Date.now() - new Date(last.createdAt).getTime() < 1800000)) {
      flags.push("REVENGE_TRADING_RISK");
    }
  }
  return flags;
};

const checkTradeRisk = async (tradeRequest, user) => {
  const { 
    symbol, side, quantity, userThinking,
    pricePaise: rawPricePaise, price,
    stopLossPaise: rawSLPaise, stopLoss,
    targetPricePaise: rawTPPaise, targetPrice
  } = tradeRequest;
  
  const finalPrice = Math.round(rawPricePaise ?? price ?? 0);
  const finalSL = Math.round(rawSLPaise ?? stopLoss ?? 0);
  const finalTP = Math.round(rawTPPaise ?? targetPrice ?? 0);

  // 0. Plan Geometry Calculations
  const riskPerUnit = Math.abs(finalPrice - finalSL);
  const rewardPerUnit = Math.abs(finalTP - finalPrice);
  const rrRatio = riskPerUnit > 0 ? Number((rewardPerUnit / riskPerUnit).toFixed(2)) : 0;


  // LAYER 1: MARKET INTELLIGENCE
  const holdings = toHoldingsObject(user?.holdings);
  const newsResponse = await newsEngine.getProcessedNews(symbol, holdings);
  const consensus = newsResponse.signals?.[0] || { verdict: "WAIT", confidence: 50, mechanism: "No clear consensus data." };

  // LAYER 2: TRADE SETUP (AI Intent + Strategy Rule)
  const parsedIntent = await parseTradeIntent(userThinking);
  const strategyAudit = validateStrategy(parsedIntent.strategy, {
     price: finalPrice,
     side,
     marketTrend: consensus.verdict === "BUY" ? "UP" : "DOWN",
     context: consensus.mechanism
  });

  // LAYER 3: BEHAVIORAL ANALYSIS
  const behavioralFlags = await getBehavioralFlags(user);
  const adaptiveProfile = await adaptiveEngine.getAdaptiveProfile(user._id);

  // LAYER 4: RISK EVALUATION (Multidimensional)
  let baseRiskImpact = (side === "BUY" && consensus.verdict === "AVOID") ? 40 : 0;
  if (!strategyAudit.isValid) baseRiskImpact += 20;
  if (behavioralFlags.includes("REVENGE_TRADING_RISK")) baseRiskImpact += 30;
  if (rrRatio < 1.5) baseRiskImpact += 15;
  
  // Adaptive IQ Adjustment
  const initialInsight = { riskLevel: baseRiskImpact > 50 ? "HIGH" : "MEDIUM", reasoning: ["Standard protocol audit."] };
  const adapted = await adaptiveEngine.adaptWarning(initialInsight, adaptiveProfile);
  
  const finalScore = Math.max(0, 100 - baseRiskImpact - (adapted.adaptedRiskLevel === "HIGH" ? 10 : 0));
  
  // LAYER 5: FINAL SCORING & VERDICT (AI CIO)
  const verdict = (finalScore < 50) ? "AVOID" : (finalScore < 70) ? "WAIT" : "BUY";

  const aiDecision = await generateFinalTradeCall({
     market: { direction: consensus.verdict, confidence: consensus.confidence, reason: consensus.judgment },
     setup: { 
       type: parsedIntent.strategy, 
       score: strategyAudit.isValid ? 90 : 40, 
       reason: `${strategyAudit.mismatchReason || "Protocol alignment confirmed."} R:R Ratio: ${rrRatio}.` 
     },
     behavior: { 
       risk: adapted.adaptedRiskLevel, 
       score: 100 - (behavioralFlags.length * 20), 
       reason: adapted.adaptiveMessage 
     },
     risk: { level: verdict === "BUY" ? "LOW" : "HIGH", score: finalScore, reason: "Multiple factor adaptive risk audit complete." },
     finalScore
  }, { verdict });

  const authority = issueDecisionToken({
    symbol,
    pricePaise: finalPrice,
    quantity,
    stopLossPaise: finalSL,
    targetPricePaise: finalTP,
    verdict,
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
          direction: consensus.verdict,
          impact: consensus.impact,
          mechanism: consensus.mechanism,
          confidence: consensus.confidence,
          alignment: consensus.verdict === side ? "OPTIMAL" : "DIVERGENT",
          sector: consensus.sector || "GENERAL"
       },
       pillars: {
          marketAlignment: {
             score: consensus.verdict === side ? 95 : 30,
             status: consensus.verdict === side ? "ALIGNED" : "CONFLICTED",
             reasoning: `Market consensus for ${symbol} is ${consensus.verdict}. Entry ${side} is ${consensus.verdict === side ? "synchronous" : "opposing"} with live intelligence.`
          },
          sectorCorrelation: {
             score: consensus.confidence > 70 ? 90 : 60,
             status: consensus.confidence > 70 ? "STRONG" : "NEUTRAL",
             reasoning: `${consensus.sector || "Sector"} signals are ${consensus.confidence > 70 ? "reinforcing" : "neutral"} regarding the current price action.`
          },
          volumeSetupStrength: {
             score: strategyAudit.isValid ? 90 : 40,
             status: strategyAudit.isValid ? "ROBUST" : "FRAGILE",
             reasoning: strategyAudit.isValid ? "Technical volume profile and setup align with institutional strategy protocols." : strategyAudit.mismatchReason
          },
          behavioralRisk: {
             score: 100 - (behavioralFlags.length * 30),
             status: behavioralFlags.length === 0 ? "DISCIPLINED" : "COMPROMISED",
             reasoning: behavioralFlags.length === 0 ? "No active behavioral biases detected." : `Detected: ${behavioralFlags.join(", ").replace(/_/g, " ")}. Emotional friction is high.`
          },
          rrQuality: {
             score: rrRatio >= 2 ? 95 : rrRatio >= 1.5 ? 75 : 40,
             status: rrRatio >= 2 ? "OPTIMAL" : rrRatio >= 1.5 ? "ACCEPTABLE" : "POOR",
             reasoning: `Reward-to-Risk ratio of ${rrRatio} ${rrRatio >= 1.5 ? "meets" : "fails"} professional capital preservation standards.`
          }
       },
       setup: {
          strategy: parsedIntent.strategy,
          isValid: strategyAudit.isValid,
          reason: strategyAudit.mismatchReason,
          confidence: parsedIntent.confidence
       },
       behavior: {
          flags: behavioralFlags,
          sensitivity: adaptiveProfile.sensitivityLevel,
          disciplineScore: 100 - (behavioralFlags.length * 30)
       },
       risk: {
          score: finalScore,
          rrRatio: rrRatio,
          verdict,
          level: verdict === "BUY" ? "OPTIMAL" : verdict === "WAIT" ? "CAUTION" : "EXTREME"
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
