const express = require('express');
const router = express.Router();
const rateLimit = require("express-rate-limit");
const newsEngine = require('../services/news/news.engine');
const authMiddleware = require('../middlewares/auth.middleware');
const { toHoldingsObject } = require('../utils/holdingsNormalizer');
const Holding = require("../models/holding.model");
const preTradeGuard = require('../services/intelligence/preTradeGuard.service');
const { validatePreTradePayload } = require("../middlewares/validateTradePayload");
const { deriveIntelligenceState, deriveDecisionState } = require("../utils/systemState");
const { adaptPreTrade } = require("../adapters/preTrade.adapter");
const logger = require("../utils/logger");
const { sendSuccess } = require("../utils/response.helper");

const intelligenceLimiter = rateLimit({
  windowMs: Number(process.env.INTELLIGENCE_RATE_LIMIT_WINDOW_MS || 60 * 1000),
  max: Number(process.env.INTELLIGENCE_RATE_LIMIT_MAX || 30),
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: "Rate limit exceeded for intelligence endpoints." },
});

/**
 * GET /api/intelligence/news
 */
const intelligenceCache = require('../utils/cache');
const { analyzeMarketIntelligence } = require('../engines/marketIntelligence.engine');

const fetchArticlesForBasket = async (basket, holdings) => {
  const results = await Promise.allSettled(basket.map(s => newsEngine.getProcessedNews(s, holdings)));
  // Extract titles/summaries from processed news if rawArticles aren't available
  // Actually, getProcessedNews returns signals. Let's try to get more context.
  return results
    .filter(r => r.status === 'fulfilled')
    .flatMap(r => r.value.signals.map(s => ({ title: s.event, description: s.judgment })));
};

const refreshQueue = new Map();

const refreshBasketIntelligence = async (category, basket, holdings) => {
  // Deduplicate inflight refreshes for the same category
  if (refreshQueue.has(category)) {
    logger.info({
      service: "intelligence.route",
      step: "INTELLIGENCE_REFRESH_DEDUPE",
      status: "INFO",
      data: { category },
      timestamp: new Date().toISOString(),
    });
    return refreshQueue.get(category);
  }

  const refreshPromise = (async () => {
    try {
      const articles = await fetchArticlesForBasket(basket, holdings);
      const structured = await analyzeMarketIntelligence(articles, category);
      intelligenceCache.set("intelligence", category, structured);
      return structured;
    } catch (error) {
      logger.error({
        service: "intelligence.route",
        step: "INTELLIGENCE_REFRESH_ERROR",
        status: "FAILURE",
        data: { category, message: error?.message },
        timestamp: new Date().toISOString(),
      });
      return null;
    } finally {
      refreshQueue.delete(category);
    }
  })();

  refreshQueue.set(category, refreshPromise);
  return refreshPromise;
};


/**
 * GET /api/intelligence/news
 */
router.get('/news', authMiddleware, intelligenceLimiter, async (req, res, next) => {
  try {
    const category = "MARKET_FEED";
    const basket = ['^NSEI', '^BSESN', 'RELIANCE.NS', 'TCS.NS', 'HDFCBANK.NS'];
    const holdingDocs = await Holding.find({ userId: req.user._id });
    const holdings = toHoldingsObject(holdingDocs.map((holding) => ({
      symbol: holding.symbol,
      quantity: holding.quantity,
      avgPricePaise: holding.avgPricePaise,
    })));

    const cached = intelligenceCache.get("intelligence", category);
    if (cached) {
      const state = deriveIntelligenceState({ signals: cached?.signals || [] });
      sendSuccess(res, req,{ success: true, state, data: { ...cached, state } });
      // Non-blocking refresh
      setTimeout(() => refreshBasketIntelligence(category, basket, holdings), 0);
      return;
    }

    // Fallback sync compute
    const result = await refreshBasketIntelligence(category, basket, holdings);
    const state = deriveIntelligenceState({ signals: result?.signals || [] });
    sendSuccess(res, req,{ success: true, state, data: { ...(result || {}), state } });
  } catch (error) {
    next(error);
  }
});


/**
 * GET /api/intelligence/portfolio
 */
router.get('/portfolio', authMiddleware, intelligenceLimiter, async (req, res, next) => {
  try {
    const category = "PORTFOLIO_FEED";
    const holdingDocs = await Holding.find({ userId: req.user._id });
    const holdings = toHoldingsObject(holdingDocs.map((holding) => ({
      symbol: holding.symbol,
      quantity: holding.quantity,
      avgPricePaise: holding.avgPricePaise,
    })));
    const basket = Object.keys(holdings).slice(0, 10);

    const cached = intelligenceCache.get("intelligence", category);
    if (cached) {
      const state = deriveIntelligenceState({ signals: cached?.signals || [] });
      sendSuccess(res, req,{ success: true, state, data: { ...cached, state } });
      setTimeout(() => refreshBasketIntelligence(category, basket, holdings), 0);
      return;
    }

    const result = await refreshBasketIntelligence(category, basket, holdings);
    const state = deriveIntelligenceState({ signals: result?.signals || [] });
    sendSuccess(res, req,{ success: true, state, data: { ...(result || {}), state } });
  } catch (error) {
    next(error);
  }
});


/**
 * GET /api/intelligence/global
 */
router.get('/global', authMiddleware, intelligenceLimiter, async (req, res, next) => {
  try {
    const category = "GLOBAL_FEED";
    const globalBasket = ['CL=F', 'GC=F', '^DJI', '^GSPC', 'BTC-USD'];
    const holdingDocs = await Holding.find({ userId: req.user._id });
    const holdings = toHoldingsObject(holdingDocs.map((holding) => ({
      symbol: holding.symbol,
      quantity: holding.quantity,
      avgPricePaise: holding.avgPricePaise,
    })));

    const cached = intelligenceCache.get("intelligence", category);
    if (cached) {
      const state = deriveIntelligenceState({ signals: cached?.signals || [] });
      sendSuccess(res, req,{ success: true, state, data: { ...cached, state } });
      setTimeout(() => refreshBasketIntelligence(category, globalBasket, holdings), 0);
      return;
    }

    const result = await refreshBasketIntelligence(category, globalBasket, holdings);
    const state = deriveIntelligenceState({ signals: result?.signals || [] });
    sendSuccess(res, req,{ success: true, state, data: { ...(result || {}), state } });
  } catch (error) {
    next(error);
  }
});


const timelineService = require('../services/intelligence/timeline.service');
router.get('/timeline', authMiddleware, intelligenceLimiter, async (req, res, next) => {
  try {
    const timeline = await timelineService.getTimelineMap(req.user._id);
    const signals = timeline || [];
    const state = deriveIntelligenceState({ signals });
    sendSuccess(res, req,{ success: true, state, data: { signals, state } });
  } catch (error) {
    next(error);
  }
});

router.post('/pre-trade', authMiddleware, intelligenceLimiter, validatePreTradePayload, async (req, res, next) => {
  const startTime = Date.now();
  try {
    const riskReport = await preTradeGuard.checkTradeRisk(req.body, req.user);
    
    logger.info({
      action: "PRE_TRADE_AUDIT_COMPLETE",
      userId: req.user._id,
      traceId: req.traceId || req.requestId,
      requestId: req.requestId,
      symbol: req.body.symbol,
      verdict: riskReport.authority?.verdict,
      latency: Date.now() - startTime,
      status: "SUCCESS",
    });

    const snapshot = riskReport?.snapshot || {};
    const hasRequiredInputs =
      Boolean(snapshot.market) &&
      Boolean(snapshot.setup) &&
      Boolean(snapshot.behavior) &&
      Boolean(snapshot.risk) &&
      Boolean(snapshot.verdict);
    const isValidated =
      hasRequiredInputs &&
      snapshot.risk?.status !== "UNAVAILABLE" &&
      Boolean(riskReport?.authority?.verdict);
    const state = deriveDecisionState({ hasRequiredInputs, isValidated });

    sendSuccess(res, req,{ 
      success: true, 
      state, 
      data: adaptPreTrade(riskReport) 
    });
  } catch (error) {
    logger.error({
      action: "PRE_TRADE_AUDIT_FAIL",
      userId: req.user?._id,
      traceId: req.traceId || req.requestId,
      requestId: req.requestId,
      message: error.message,
      latency: Date.now() - startTime,
      status: "FAIL",
    });
    next(error);
  }
});


const adaptiveEngine = require('../services/intelligence/adaptiveEngine.service');
router.get('/profile', authMiddleware, intelligenceLimiter, async (req, res, next) => {
  try {
    const profile = await adaptiveEngine.getAdaptiveProfile(req.user._id);
    sendSuccess(res, req,{ success: true, data: profile });
  } catch (error) {
    next(error);
  }
});

const judgmentEngine = require('../services/intelligence/judgmentEngine.service');
router.post('/judge-trade', authMiddleware, intelligenceLimiter, async (req, res, next) => {
  try {
    const judgment = await judgmentEngine.generateJudgment(req.body, req.user);
    sendSuccess(res, req,{ success: true, data: judgment });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
