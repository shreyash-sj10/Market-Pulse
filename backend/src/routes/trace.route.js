const express = require("express");
const router = express.Router();
const traceController = require("../controllers/trace.controller");
const protect = require("../middlewares/auth.middleware");

router.use(protect);

router.get("/", traceController.getTraces);
router.get("/:trace_id", traceController.getTraceById);

module.exports = router;
