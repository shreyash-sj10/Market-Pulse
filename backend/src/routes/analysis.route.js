const express = require("express");
const router = express.Router();
const analysisController = require("../controllers/analysis.controller");
const protect = require("../middlewares/auth.middleware");

router.get("/summary", protect, analysisController.getAnalysisSummary);

module.exports = router;
