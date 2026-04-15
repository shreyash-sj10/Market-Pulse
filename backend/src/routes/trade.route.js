const express = require("express");
const router = express.Router();

const protect = require("../middlewares/auth.middleware");
const {
  buyTrade,
  sellTrade,
  getTradeHistory,
} = require("../controllers/trade.controller");

const rateLimit = require("express-rate-limit");
const { validateTradePayload } = require("../middlewares/validateTradePayload");

const tradeLimiter = rateLimit({
  windowMs: process.env.NODE_ENV === "test" ? 10 * 1000 : 10 * 1000,
  max: process.env.NODE_ENV === "test" ? 10 : 5,

  message: { success: false, message: "Excessive trade requests. Cooldown required for institutional compliance." },
  standardHeaders: true,
  legacyHeaders: false,
});


// --- Execution Guards ---
const enforceReview = (req, res, next) => {
  if (!req.body.decisionContext && !req.body.userThinking) {
     return res.status(403).json({ success: false, message: "REVIEW_REQUIRED: Trades must be initiated via decision engine." });
  }
  next();
};

const enforceRequestId = (req, res, next) => {
  const requestId = req.headers["idempotency-key"];
  if (!requestId || typeof requestId !== "string" || requestId.trim().length === 0) {
    return res.status(400).json({
      success: false,
      message: "REQUEST_ID_REQUIRED"
    });
  }
  next();
};

const enforceBuyReview = (req, res, next) => {
  const preTradeToken = req.headers["pre-trade-token"] || req.body.preTradeToken;
  const { stopLossPaise, targetPricePaise } = req.body;

  if (!stopLossPaise || !targetPricePaise) {
    return res.status(403).json({
      success: false,
      message: "PLAN_REQUIRED: Buy orders must include stopLossPaise and targetPricePaise."
    });
  }

  if (!preTradeToken) {
    return res.status(403).json({
      success: false,
      message: "PRE_TRADE_REQUIRED: Institutional trades must include a valid preTradeToken."
    });
  }

  req.body.token = preTradeToken;
  next();
};

const enforceSellReview = (req, res, next) => {
  const preTradeToken = req.headers["pre-trade-token"] || req.body.preTradeToken;

  if (!preTradeToken) {
    return res.status(403).json({
      success: false,
      message: "PRE_TRADE_REQUIRED: Sell orders must include a valid preTradeToken."
    });
  }

  req.body.token = preTradeToken;
  next();
};


const { isMarketOpen } = require("../services/marketHours.service");
const logger = require("../lib/logger");

const checkMarketClock = (req, res, next) => {
  if (!isMarketOpen()) {
    logger.warn({
      action: "MARKET_CLOSED_EXECUTION",
      userId: req.user?._id,
      requestId: req.headers["idempotency-key"],
      message: "Order placed outside of active market hours. Execution queued."
    });
  }
  next();
};

router.get("/", protect, getTradeHistory);

// Only allow execution via reviewed flow
router.post("/buy", protect, tradeLimiter, enforceReview, enforceRequestId, validateTradePayload, enforceBuyReview, checkMarketClock, buyTrade);
router.post("/sell", protect, tradeLimiter, enforceReview, enforceRequestId, validateTradePayload, enforceSellReview, checkMarketClock, sellTrade);


module.exports = router;

