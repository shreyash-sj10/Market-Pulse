const express = require("express");
const router = express.Router();
const { snapshot } = require("../middlewares/requestMetrics");
const { listByTraceId } = require("../utils/traceEventBuffer");
const Outbox = require("../models/outbox.model");
const { sendSuccess } = require("../utils/response.helper");

/**
 * Public-ish ops metrics (no secrets). For detailed auth metrics, extend later.
 */
router.get("/metrics", (req, res) => {
  const m = snapshot();
  sendSuccess(res, req, {
    status: "ok",
    ...m,
    meta: { traceId: req.traceId || req.requestId },
  });
});

router.get("/jobs/summary", async (req, res, next) => {
  try {
    const [pending, processing, failed] = await Promise.all([
      Outbox.countDocuments({ status: "PENDING" }),
      Outbox.countDocuments({ status: "PROCESSING" }),
      Outbox.countDocuments({ status: "FAILED" }),
    ]);
    sendSuccess(res, req, {
      success: true,
      data: { pending, processing, failed },
      meta: { traceId: req.traceId || req.requestId },
    });
  } catch (e) {
    next(e);
  }
});

/**
 * Dev/debug: last buffered events for a traceId (requires ENABLE_TRACE_BUFFER or non-production).
 */
router.get("/traces/:traceId", (req, res) => {
  const { traceId } = req.params;
  if (process.env.NODE_ENV === "production" && process.env.ENABLE_TRACE_BUFFER !== "true") {
    return sendSuccess(res, req, {
      success: false,
      message: "TRACE_BUFFER_DISABLED",
      meta: { traceId: req.traceId || req.requestId },
    }, 404);
  }
  const events = listByTraceId(traceId);
  sendSuccess(res, req, {
    success: true,
    data: { traceId, events },
    meta: { traceId: req.traceId || req.requestId },
  });
});

module.exports = router;
