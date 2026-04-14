const { adaptAIResponse } = require("./ai.adapter");

const adaptPreTrade = (preTradeResponse) => {
  if (!preTradeResponse) return null;

  const { snapshot, authority, token } = preTradeResponse;

  const riskScore = snapshot?.risk?.score || 0;

  const warnings = [
    ...(snapshot?.behavior?.flags || []),
    ...(snapshot?.risk?.status === "INVALID" || snapshot?.risk?.status === "FAIL" ? [snapshot?.risk?.reason] : []),
  ].filter(Boolean);

  const signals = [];
  if (snapshot?.pillars) {
      Object.values(snapshot.pillars).forEach(pillar => {
          if (pillar?.reasoning) {
              signals.push(pillar.reasoning);
          }
      });
  }
  
  if (snapshot?.setup?.isValid) {
      signals.push(`Strategy valid: ${snapshot.setup.strategy}`);
  } else if (snapshot?.setup?.reason) {
      warnings.push(`Strategy mismatch: ${snapshot.setup.reason}`);
  }

  const allowedVerdict = authority?.verdict || snapshot?.risk?.verdict;
  const allowed = Boolean(allowedVerdict && allowedVerdict !== "WAIT" && allowedVerdict !== "AVOID" && allowedVerdict !== "BLOCK");

  return {
    allowed,
    token: authority?.token || token || null,
    snapshot: {
      riskScore,
      warnings,
      signals,
    },
    ai: adaptAIResponse(snapshot?.ai)
  };
};

module.exports = { adaptPreTrade };
