/**
 * Response-shape builder for AI explanations (DTO assembly).
 * For inbound validation, see `src/validations/`. For transport transforms, see `src/adapters/`.
 */
function buildAIResponse(normalizedData = null, isUnavailable = false) {
  if (isUnavailable || !normalizedData) {
    return {
      status: "UNAVAILABLE",
      explanation: { summary: "", keyFactors: [], warnings: [] },
      behavior: { tag: "UNKNOWN", explanation: "" },
      learning: { lesson: "", improvement: "" },
      meta: { confidence: 0, source: "AI", generatedAt: new Date().toISOString() }
    };
  }

  return {
    status: "OK",
    explanation: {
      summary: normalizedData.summary || "",
      keyFactors: normalizedData.keyFactors || [],
      warnings: normalizedData.warnings || []
    },
    behavior: {
      tag: normalizedData.tag || "UNKNOWN",
      explanation: normalizedData.explanation || ""
    },
    learning: {
      lesson: normalizedData.lesson || "",
      improvement: normalizedData.improvement || ""
    },
    meta: {
      confidence: typeof normalizedData.confidence === 'number' ? normalizedData.confidence : 0.5,
      source: "AI",
      generatedAt: new Date().toISOString()
    }
  };
}

module.exports = { buildAIResponse };
