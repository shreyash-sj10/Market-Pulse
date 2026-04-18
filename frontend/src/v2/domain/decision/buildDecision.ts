export type Decision = {
  action: "ACT" | "GUIDE" | "BLOCK";
  confidence: number;
  reason: string;
};

export type BuildDecisionInput = {
  allowed: boolean;
  riskScore: number;
  warnings?: boolean | string[];
  fallback?: boolean;
  aiUnavailable?: boolean;
};

function clampRiskScore(value: number): number {
  if (!Number.isFinite(value)) return 0;
  if (value < 0) return 0;
  if (value > 100) return 100;
  return Math.round(value);
}

function hasWarnings(warnings?: boolean | string[]): boolean {
  if (Array.isArray(warnings)) return warnings.length > 0;
  return Boolean(warnings);
}

export function buildDecision(input: BuildDecisionInput): Decision {
  const riskScore = clampRiskScore(input.riskScore);
  const warningFlag = hasWarnings(input.warnings);
  const fallback = Boolean(input.fallback);
  const aiUnavailable = Boolean(input.aiUnavailable);

  // Boundary:
  // >=70 ACT (inclusive)
  // <70 NOT ACT
  if (!input.allowed) {
    return { action: "BLOCK", confidence: riskScore, reason: "Blocked: trading not allowed." };
  }

  if (riskScore < 50) {
    return { action: "BLOCK", confidence: riskScore, reason: "Blocked: risk score below 50." };
  }

  if (riskScore >= 70 && input.allowed && !warningFlag && !fallback && !aiUnavailable) {
    return { action: "ACT", confidence: riskScore, reason: "Act: conditions satisfy execution threshold." };
  }

  if (riskScore >= 50 && riskScore < 70) {
    return { action: "GUIDE", confidence: riskScore, reason: "Guide: risk score between 50 and 69." };
  }

  if (warningFlag || fallback || aiUnavailable) {
    if (warningFlag) {
      return { action: "GUIDE", confidence: riskScore, reason: "Guide: warnings require review." };
    }

    if (fallback) {
      return { action: "GUIDE", confidence: riskScore, reason: "Guide: fallback mode enabled." };
    }

    if (aiUnavailable) {
      return { action: "GUIDE", confidence: riskScore, reason: "Guide: AI unavailable." };
    }

    return { action: "GUIDE", confidence: riskScore, reason: "Guide: fallback guard active." };
  }

  return { action: "GUIDE", confidence: riskScore, reason: "Guide: manual review required." };
}
