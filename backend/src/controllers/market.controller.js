const marketDataService = require('../services/marketData.service');
const Holding = require("../models/holding.model");
const { toHoldingsObject } = require("../utils/holdingsNormalizer");
const { deriveIntelligenceState } = require("../utils/systemState");

const getQuote = async (req, res, next) => {
  try {
    const { symbol } = req.query;
    if (!symbol) return res.status(400).json({ success: false, message: "Symbol required" });
    const data = await marketDataService.resolvePrice(symbol);
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
      const holdingsDocs = await Holding.find({ userId: req.user._id });
      const userHoldings = toHoldingsObject(holdingsDocs.map((holding) => ({
        symbol: holding.symbol,
        quantity: holding.quantity,
        avgPricePaise: holding.avgPricePaise,
      })));
      data = await newsEngine.getProcessedNews(symbol, userHoldings);
      const state = deriveIntelligenceState({ signals: data?.signals || [] });
      res.json({ success: true, state, ...data });
    } else {
      const newsData = await newsEngine.getTopNews();
      res.json({ success: true, ...newsData });
    }
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
    const holdingsDocs = await Holding.find({ userId: req.user._id });
    const userHoldings = toHoldingsObject(holdingsDocs.map((holding) => ({
      symbol: holding.symbol,
      quantity: holding.quantity,
      avgPricePaise: holding.avgPricePaise,
    })));
    const data = await newsEngine.getPortfolioNews(userHoldings);
    const state = deriveIntelligenceState({ signals: data?.signals || [] });
    res.json({ success: true, state, ...data });
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
  getQuote,
  getHistory,
  getNews,
  getFundamentals,
  validateSymbol,
  getPortfolioNews,
  getIndices
};
