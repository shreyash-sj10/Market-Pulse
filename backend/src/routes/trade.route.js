const express = require("express");
const router = express.Router();

const protect = require("../middlewares/auth.middleware");
const { createTradeSchema, validateData } = require("../validations/trade.schema");
const {
  buyTrade,
  sellTrade,
  getTradeHistory,
} = require("../controllers/trade.controller");

const rateLimit = require("express-rate-limit");

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

const enforceBuyReview = (req, res, next) => {
  const { stopLoss, targetPrice, price, pricePaise: rawPricePaise, stopLossPaise, targetPricePaise } = req.body;
  const preTradeToken = req.headers["pre-trade-token"] || req.body.preTradeToken;

  const finalPrice = Math.round(rawPricePaise ?? price ?? 0);
  const finalSL = Math.round(stopLossPaise ?? stopLoss ?? 0);
  const finalTP = Math.round(targetPricePaise ?? targetPrice ?? 0);

  if (!finalSL || !finalTP) {
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

  // Risk/Reward Enforcement (Pre-Controller)
  const risk = finalPrice - finalSL;
  const reward = finalTP - finalPrice;
  const rr = risk > 0 ? reward / risk : 0;

  if (rr < 1.2) {
    return res.status(403).json({
      success: false,
      message: "INVALID_RR: Plan does not meet minimum 1.2 risk/reward ratio."
    });
  }

  // Canonicalize for Service
  req.body.token = preTradeToken;
  req.body.pricePaise = finalPrice;
  req.body.stopLossPaise = finalSL;
  req.body.targetPricePaise = finalTP;
  next();
};



router.get("/", protect, getTradeHistory);

// Only allow execution via reviewed flow
router.post("/buy", protect, tradeLimiter, validateData(createTradeSchema), enforceReview, enforceBuyReview, buyTrade);
router.post("/sell", protect, tradeLimiter, validateData(createTradeSchema), enforceReview, sellTrade);


module.exports = router;

