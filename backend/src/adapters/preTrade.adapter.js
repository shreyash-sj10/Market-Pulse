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

  const authToken = authority?.token || token || null;
  const authExpires = authority?.expiresAt ?? preTradeResponse.expiresAt ?? null;
  const authVerdict = authority?.verdict ?? snapshot?.risk?.verdict ?? null;

  return {
    allowed,
    token: authToken,
    expiresAt: authExpires,
    /** Required by execution + NOESIS panel (must not be stripped). */
    authority: {
      token: authToken,
      expiresAt: authExpires,
      verdict: authVerdict,
    },
    /** Full engine snapshot (risk, pillars, behavior, market) — UI + trade gating depend on this shape. */
    snapshot,
    ai: adaptAIResponse(snapshot?.ai),
    /** Convenience rollups for lighter clients; not a substitute for `snapshot`. */
    summary: {
      riskScore,
      warnings,
      signals,
    },
  };
};

module.exports = { adaptPreTrade };
