const express = require('express');
const router = express.Router();
const newsEngine = require('../services/news/news.engine');
const authMiddleware = require('../middlewares/auth.middleware');
const { toHoldingsObject } = require('../utils/holdingsNormalizer');
const preTradeGuard = require('../services/intelligence/preTradeGuard.service');

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
     console.log(`[PERF] Intelligence refresh already in progress for ${category}, joining queue.`);
     return refreshQueue.get(category);
  }

  const refreshPromise = (async () => {
    try {
      const articles = await fetchArticlesForBasket(basket, holdings);
      const structured = await analyzeMarketIntelligence(articles, category);
      intelligenceCache.set("intelligence", category, structured);
      return structured;
    } catch (error) {
      console.error(`[IntelligenceRefresh] Error for ${category}:`, error);
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
router.get('/news', authMiddleware, async (req, res, next) => {
  try {
    const category = "MARKET_FEED";
    const basket = ['^NSEI', '^BSESN', 'RELIANCE.NS', 'TCS.NS', 'HDFCBANK.NS'];
    const holdings = toHoldingsObject(req.user?.holdings);

    const cached = intelligenceCache.get("intelligence", category);
    if (cached) {
      res.json({ success: true, data: cached });
      // Non-blocking refresh
      setTimeout(() => refreshBasketIntelligence(category, basket, holdings), 0);
      return;
    }

    // Fallback sync compute
    const result = await refreshBasketIntelligence(category, basket, holdings);
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});


/**
 * GET /api/intelligence/portfolio
 */
router.get('/portfolio', authMiddleware, async (req, res, next) => {
  try {
    const category = "PORTFOLIO_FEED";
    const holdings = toHoldingsObject(req.user?.holdings);
    const basket = Object.keys(holdings).slice(0, 10);

    const cached = intelligenceCache.get("intelligence", category);
    if (cached) {
      res.json({ success: true, data: cached });
      setTimeout(() => refreshBasketIntelligence(category, basket, holdings), 0);
      return;
    }

    const result = await refreshBasketIntelligence(category, basket, holdings);
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});


/**
 * GET /api/intelligence/global
 */
router.get('/global', authMiddleware, async (req, res, next) => {
  try {
    const category = "GLOBAL_FEED";
    const globalBasket = ['CL=F', 'GC=F', '^DJI', '^GSPC', 'BTC-USD'];
    const holdings = toHoldingsObject(req.user?.holdings);

    const cached = intelligenceCache.get("intelligence", category);
    if (cached) {
      res.json({ success: true, data: cached });
      setTimeout(() => refreshBasketIntelligence(category, globalBasket, holdings), 0);
      return;
    }

    const result = await refreshBasketIntelligence(category, globalBasket, holdings);
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});


const timelineService = require('../services/intelligence/timeline.service');
router.get('/timeline', authMiddleware, async (req, res, next) => {
  try {
    const timeline = await timelineService.getTimelineMap(req.user._id);
    res.json({ success: true, data: { signals: (timeline || []) } });
  } catch (error) {
    next(error);
  }
});

const logger = require("../lib/logger");

router.post('/pre-trade', authMiddleware, async (req, res, next) => {
  const startTime = Date.now();
  try {
    const riskReport = await preTradeGuard.checkTradeRisk(req.body, req.user);
    
    logger.info({
      action: "PRE_TRADE_AUDIT_COMPLETE",
      userId: req.user._id,
      requestId: req.requestId,
      symbol: req.body.symbol,
      verdict: riskReport.authority?.verdict,
      latency: Date.now() - startTime,
      status: "SUCCESS"
    });

    res.json({ success: true, data: riskReport });
  } catch (error) {
    logger.error({
      action: "PRE_TRADE_AUDIT_FAIL",
      userId: req.user?._id,
      requestId: req.requestId,
      message: error.message,
      latency: Date.now() - startTime,
      status: "FAIL"
    });
    next(error);
  }
});


const adaptiveEngine = require('../services/intelligence/adaptiveEngine.service');
router.get('/profile', authMiddleware, async (req, res, next) => {
  try {
    const profile = await adaptiveEngine.getAdaptiveProfile(req.user._id);
    res.json({ success: true, data: profile });
  } catch (error) {
    next(error);
  }
});

const judgmentEngine = require('../services/intelligence/judgmentEngine.service');
router.post('/judge-trade', authMiddleware, async (req, res, next) => {
  try {
    const judgment = await judgmentEngine.generateJudgment(req.body, req.user);
    res.json({ success: true, data: judgment });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
