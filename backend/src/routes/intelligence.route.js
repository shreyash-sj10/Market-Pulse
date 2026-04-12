const express = require('express');
const router = express.Router();
const newsEngine = require('../services/news/news.engine');
const authMiddleware = require('../middlewares/auth.middleware');

/**
 * GET /api/intelligence/news
 */
router.get('/news', authMiddleware, async (req, res, next) => {
  try {
    const basket = [
      '^NSEI', '^BSESN', '^NSEBANK',
      'RELIANCE.NS', 'TCS.NS', 'HDFCBANK.NS', 'INFY.NS', 'ICICIBANK.NS',
      'SBIN.NS', 'BHARTIARTL.NS'
    ];
    
    const basketsResults = await Promise.allSettled(
      basket.map(s => newsEngine.getProcessedNews(s, req.user.holdings))
    );

    const allSignals = basketsResults
      .filter(r => r.status === 'fulfilled' && r.value && r.value.signals)
      .flatMap(r => r.value.signals)
      .filter(s => s && s.title); // HARDENED FILTER

    const seen = new Set();
    const uniqueSignals = allSignals.filter(item => {
      const k = (item.title || "").toLowerCase();
      if (!k || seen.has(k)) return false;
      seen.add(k);
      return true;
    });

    res.json({ 
      success: true, 
      data: { signals: uniqueSignals.sort((a, b) => b.confidence - a.confidence).slice(0, 40) }
    });
  } catch (error) {
    console.error("[IntelligenceRoute] Error in /news:", error);
    next(error);
  }
});

/**
 * GET /api/intelligence/portfolio
 */
router.get('/portfolio', authMiddleware, async (req, res, next) => {
  try {
    const portfolioNews = await newsEngine.getPortfolioNews(req.user.holdings);
    res.json({ 
      success: true, 
      data: { signals: (portfolioNews?.signals || []).filter(s => s && s.title) }
    });
  } catch (error) {
    console.error("[IntelligenceRoute] Error in /portfolio:", error);
    next(error);
  }
});

/**
 * GET /api/intelligence/global
 */
router.get('/global', authMiddleware, async (req, res, next) => {
  try {
    const globalBasket = [
      'CL=F', 'GC=F', '^DJI', '^GSPC', '^IXIC', 'BTC-USD', '^FTSE'
    ];
    
    const globalResults = await Promise.allSettled(
      globalBasket.map((s) => newsEngine.getProcessedNews(s, req.user.holdings))
    );

    const allGlobalSignals = globalResults
      .filter((r) => r.status === 'fulfilled' && r.value && r.value.signals)
      .flatMap((r) => r.value.signals)
      .filter(s => s && s.title);

    const seen = new Set();
    const uniqueGlobalSignals = allGlobalSignals.filter((item) => {
      const key = (item.title || "").toLowerCase();
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    res.json({ 
      success: true, 
      data: { signals: uniqueGlobalSignals.sort((a, b) => b.confidence - a.confidence).slice(0, 40) }
    });
  } catch (error) {
    console.error("[IntelligenceRoute] Error in /global:", error);
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

const preTradeGuard = require('../services/intelligence/preTradeGuard.service');
router.post('/pre-trade', authMiddleware, async (req, res, next) => {
  try {
    const riskReport = await preTradeGuard.checkTradeRisk(req.body, req.user);
    res.json({ success: true, data: riskReport });
  } catch (error) {
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
