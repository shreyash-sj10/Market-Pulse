const express = require('express');
const router = express.Router();
const marketController = require('../controllers/market.controller');
const marketDataService = require('../services/marketData.service');

// ─── NEW MARKET INTELLIGENCE LAYER ───
router.get('/indices', marketController.getIndices);
router.get('/validate', marketController.validateSymbol);
router.get('/price', marketController.getPrice);
router.get('/history', marketController.getHistory);
router.get('/fundamentals', marketController.getFundamentals);
router.get('/news', marketController.getNews);
router.get('/news/portfolio', marketController.getPortfolioNews);

// ─── LEGACY / SYSTEM ROUTES ───
router.get('/explore', async (req, res, next) => {
  try {
    const limit = parseInt(req.query.limit) || 16;
    const offset = parseInt(req.query.offset) || 0;
    const search = req.query.query || "";
    const stocks = await marketDataService.getExploreData(limit, offset, search);
    res.json({ success: true, stocks });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
