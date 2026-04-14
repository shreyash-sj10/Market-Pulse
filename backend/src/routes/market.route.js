const express = require('express');
const router = express.Router();
const marketController = require('../controllers/market.controller');
const marketDataService = require('../services/marketData.service');
const protect = require("../middlewares/auth.middleware");

// ─── NEW MARKET INTELLIGENCE LAYER ───
router.get('/indices', marketController.getIndices);
router.get('/overview', marketController.getMarketOverview);
router.get('/validate', marketController.validateSymbol);
router.get('/quote', marketController.getQuote);
router.get('/history', marketController.getHistory);
router.get('/fundamentals', marketController.getFundamentals);
router.get('/news', marketController.getNews);
router.get('/news/portfolio', protect, marketController.getPortfolioNews);

// ─── LEGACY / SYSTEM ROUTES ───
router.get('/explore', async (req, res, next) => {
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
