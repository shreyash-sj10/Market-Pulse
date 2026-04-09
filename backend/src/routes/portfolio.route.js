const express = require("express");
const router = express.Router();

const protect = require("../middlewares/auth.middleware");
const { getPortfolioSummary, getPositions } = require("../controllers/portfolio.controller");

router.get("/summary", protect, getPortfolioSummary);
router.get("/positions", protect, getPositions);

module.exports = router;
