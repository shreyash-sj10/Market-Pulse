const { buildAIResponse } = require("../contracts/aiResponse.contract");

const adaptToAIResponse = (normalized) => {
  if (!normalized) {
    return buildAIResponse(null, true);
  }
  return buildAIResponse(normalized, false);
};

module.exports = { adaptToAIResponse };
