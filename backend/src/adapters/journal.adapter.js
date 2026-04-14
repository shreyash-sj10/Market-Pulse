const adaptJournal = (tradeOrCard) => {
  if (!tradeOrCard) return null;

  const verdict = tradeOrCard.outcome || tradeOrCard.verdict || tradeOrCard.learningOutcome?.verdict || "UNKNOWN";
  const primaryMistake = tradeOrCard.insight?.why || tradeOrCard.learningOutcome?.type || "N/A";
  const insight = tradeOrCard.insight?.what || tradeOrCard.learningOutcome?.insight || "N/A";
  const correction = tradeOrCard.insight?.improvement || tradeOrCard.learningOutcome?.improvementSuggestion || "N/A";
  
  let confidence = tradeOrCard.confidence || tradeOrCard.learningSurface?.confidence;
  if (confidence === undefined || confidence === null) {
      if (tradeOrCard.learningOutcome?.confidence !== undefined) {
         confidence = tradeOrCard.learningOutcome.confidence;
      } else {
         confidence = 50;
      }
  }

  let tags = [];
  if (Array.isArray(tradeOrCard.tags)) {
      tags = tradeOrCard.tags;
  } else if (tradeOrCard.learningOutcome?.executionPattern) {
      tags = [tradeOrCard.learningOutcome.executionPattern];
  }

  return {
    verdict,
    primaryMistake,
    insight,
    correction,
    confidence,
    tags
  };
};

module.exports = { adaptJournal };
