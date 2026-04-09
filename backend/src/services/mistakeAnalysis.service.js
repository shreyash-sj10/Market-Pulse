const calculateMistakeAnalysis = ({
  tradeValue,
  balanceBeforeTrade,
  stopLoss,
  targetPrice,
  entryPrice,
  tradesLast24h,
}) => {
  let riskScore = 0;
  const mistakeTags = new Set();

  // ================= RULE 1 — OVER_RISK =================
  const riskPercent = (tradeValue / balanceBeforeTrade) * 100;

  if (riskPercent > 20) {
    riskScore += 40;
    mistakeTags.add("OVER_RISK");
  } else if (riskPercent > 10) {
    riskScore += 25;
    mistakeTags.add("OVER_RISK");
  } else if (riskPercent > 5) {
    riskScore += 10;
    mistakeTags.add("OVER_RISK");
  }

  // ================= RULE 2 — NO_STOP_LOSS =================
  if (!stopLoss) {
    riskScore += 20;
    mistakeTags.add("NO_STOP_LOSS");
  }

  // ================= RULE 3 — POOR_RR =================
  if (stopLoss && targetPrice && entryPrice) {
    const risk = Math.abs(entryPrice - stopLoss);
    const reward = Math.abs(targetPrice - entryPrice);

    if (risk > 0) {
      const rr = reward / risk;

      if (rr < 1) {
        riskScore += 25;
        mistakeTags.add("POOR_RR");
      } else if (rr < 2) {
        riskScore += 10;
        mistakeTags.add("POOR_RR");
      }
    }
  }

  // ================= RULE 4 — OVERTRADING =================
  if (tradesLast24h > 10) {
    riskScore += 20;
    mistakeTags.add("OVERTRADING");
  } else if (tradesLast24h > 5) {
    riskScore += 10;
    mistakeTags.add("OVERTRADING");
  }

  // Clamp score
  if (riskScore > 100) riskScore = 100;

  return {
    riskScore,
    mistakeTags: Array.from(mistakeTags),
  };
};

module.exports = calculateMistakeAnalysis;
