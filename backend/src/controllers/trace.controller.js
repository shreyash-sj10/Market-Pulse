const Trace = require("../models/trace.model");

const getTraces = async (req, res, next) => {
  try {
    const traces = await Trace.find({ "metadata.user": req.user._id })
      .select("type timestamp humanSummary.verdict humanSummary.decisionSummary _id")
      .sort({ timestamp: -1 })
      .limit(50);
    
    res.status(200).json({ 
      success: true, 
      data: {
        list: traces.map(t => ({
          id: t._id,
          type: t.type,
          timestamp: t.timestamp,
          verdict: t.humanSummary?.verdict || "NEUTRAL",
          summary: t.humanSummary?.decisionSummary || "System state log generated."
        }))
      },
      meta: { count: traces.length }
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
      return res.status(404).json({ success: false, message: "Trace not found" });
    }
    
    res.status(200).json({ 
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
