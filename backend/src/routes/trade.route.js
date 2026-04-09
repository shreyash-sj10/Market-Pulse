const express = require("express");
const router = express.Router();

const protect = require("../middlewares/auth.middleware");
const { createTradeSchema, validateData } = require("../validations/trade.schema");
const {
  buyTrade,
  sellTrade,
  getTradeHistory,
} = require("../controllers/trade.controller");

router.get("/", protect, getTradeHistory);
router.post("/buy", protect, validateData(createTradeSchema), buyTrade);
router.post("/sell", protect, validateData(createTradeSchema), sellTrade);

module.exports = router;
