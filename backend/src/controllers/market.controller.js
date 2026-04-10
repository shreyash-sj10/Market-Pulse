const marketDataService = require('../services/marketData.service');

const getPrice = async (req, res, next) => {
  try {
    const { symbol } = req.query;
    if (!symbol) return res.status(400).json({ success: false, message: "Symbol required" });
    const data = await marketDataService.getLivePrice(symbol);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

const getHistory = async (req, res, next) => {
  try {
    const { symbol, period } = req.query;
    if (!symbol) return res.status(400).json({ success: false, message: "Symbol required" });
    const data = await marketDataService.getHistorical(symbol, period);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

const newsEngine = require('../services/news/news.engine');

const getNews = async (req, res, next) => {
  try {
    const { symbol } = req.query;

    let data;
    if (symbol) {
      const userHoldings = req.user?.holdings || {};
      data = await newsEngine.getProcessedNews(symbol, userHoldings);
    } else {
      data = await newsEngine.getTopNews();
    }

    // For general news page compatibility (it expects an array)
    if (!symbol) {
      return res.json(data.news);
    }

    res.json({ success: true, ...data });
  } catch (error) {
    next(error);
  }
};

const getFundamentals = async (req, res, next) => {
  try {
    const { symbol } = req.query;
    if (!symbol) return res.status(400).json({ success: false, message: "Symbol required" });
    const data = await marketDataService.getFundamentals(symbol);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

const validateSymbol = async (req, res, next) => {
  try {
    const { symbol } = req.query;
    if (!symbol) return res.status(400).json({ success: false, message: "Symbol required" });
    const result = await marketDataService.validateSymbol(symbol);
    res.json({ success: true, ...result });
  } catch (error) {
    next(error);
  }
};

const getPortfolioNews = async (req, res, next) => {
  try {
    const userHoldings = req.user?.holdings || {};
    const data = await newsEngine.getPortfolioNews(userHoldings);
    res.json({ success: true, ...data });
  } catch (error) {
    next(error);
  }
};

const getIndices = async (req, res, next) => {
  try {
    const results = await marketDataService.getMarketIndices();
    res.json(results);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getPrice,
  getHistory,
  getNews,
  getFundamentals,
  validateSymbol,
  getPortfolioNews,
  getIndices
};
