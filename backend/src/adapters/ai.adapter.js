const adaptAIResponse = (ai) => {
  if (!ai) {
    return {
      status: "UNAVAILABLE",
      explanation: {
        summary: "",
        warnings: [],
        keyFactors: []
      }
    };
  }

  return {
    status: ai.status || "OK",
    explanation: {
      summary: ai.explanation?.summary || "",
      warnings: Array.isArray(ai.explanation?.warnings) ? ai.explanation.warnings : [],
      keyFactors: Array.isArray(ai.explanation?.keyFactors) ? ai.explanation.keyFactors : []
    }
  };
};

module.exports = { adaptAIResponse };
