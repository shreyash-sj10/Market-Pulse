const Trace = require("../models/trace.model");
const { sendSuccess } = require("../utils/response.helper");

const getTraces = async (req, res, next) => {
  try {
    const traces = await Trace.find({ "metadata.user": req.user._id })
      .select(
        "type timestamp decision action final_score explanation humanSummary.verdict humanSummary.decisionSummary humanSummary.simpleExplanation _id",
      )
      .sort({ timestamp: -1 })
      .limit(50);

    sendSuccess(res, req, {
      success: true,
      data: {
        list: traces.map((t) => {
          const summary = (
            t.humanSummary?.decisionSummary ||
            t.decision ||
            ""
          ).trim();
          const reason = [t.explanation, t.humanSummary?.simpleExplanation]
            .filter(Boolean)
            .join(" ")
            .trim();
          return {
            id: t._id,
            type: t.type,
            timestamp: t.timestamp,
            verdict: t.humanSummary?.verdict || "NEUTRAL",
            summary: summary || "System trace event.",
            systemAction: t.action ? String(t.action).toUpperCase() : null,
            confidence: t.final_score != null ? Number(t.final_score) : null,
            reason: reason || summary,
          };
        }),
      },
      meta: { count: traces.length },
    });
  } catch (error) {
    next(error);
  }
};

const getTraceById = async (req, res, next) => {
  try {
    const trace = await Trace.findOne({ 
      _id: req.params.trace_id, 
      "metadata.user": req.user._id 
    });
    
    if (!trace) {
      return sendSuccess(res, req, { success: false, message: "Trace not found" }, 404);
    }
    
    sendSuccess(res, req, {
      success: true,
      data: trace,
      meta: { timestamp: new Date(), traceId: trace._id }
    });
  } catch (error) {
    next(error);
  }
};


module.exports = {
  getTraces,
  getTraceById
};
