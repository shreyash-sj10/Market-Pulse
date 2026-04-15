const express = require('express');
const router = express.Router();
const rateLimit = require("express-rate-limit");
const marketController = require('../controllers/market.controller');
const marketDataService = require('../services/marketData.service');
const protect = require("../middlewares/auth.middleware");

const marketReadLimiter = rateLimit({
  windowMs: Number(process.env.MARKET_RATE_LIMIT_WINDOW_MS || 60 * 1000),
  max: Number(process.env.MARKET_RATE_LIMIT_MAX || 60),
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: "Rate limit exceeded for market data endpoints." },
});

// ─── NEW MARKET INTELLIGENCE LAYER ───
router.get('/indices', marketReadLimiter, marketController.getIndices);
router.get('/overview', marketReadLimiter, marketController.getMarketOverview);
router.get('/validate', marketReadLimiter, marketController.validateSymbol);
router.get('/quote', marketReadLimiter, marketController.getQuote);
router.get('/history', marketReadLimiter, marketController.getHistory);
router.get('/fundamentals', marketReadLimiter, marketController.getFundamentals);
router.get('/news', protect, marketReadLimiter, marketController.getNews);
router.get('/news/portfolio', protect, marketReadLimiter, marketController.getPortfolioNews);

// ─── LEGACY / SYSTEM ROUTES ───
router.get('/explore', marketReadLimiter, async (req, res, next) => {
  try {
    const limit = parseInt(req.query.limit) || 16;
    const offset = parseInt(req.query.offset) || 0;
    const search = req.query.query || "";
    const result = await marketDataService.getExploreData(limit, offset, search);
    res.json({ success: true, ...result });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
