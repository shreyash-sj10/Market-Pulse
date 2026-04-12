const express = require("express");
const router = express.Router();
const protect = require("../middlewares/auth.middleware");
const { getJournalSummary } = require("../controllers/journal.controller");

router.get("/summary", protect, getJournalSummary);

module.exports = router;
