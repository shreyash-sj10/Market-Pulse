/**
 * DETERMINISTIC TRADE IMPACT ENGINE
 * Converts raw news signals into actionable intelligence via traceable rule-sets.
 */

const SECTOR_MAP = {
  BANKING: ["HDFCBANK", "ICICIBANK", "AXISBANK", "SBIN", "KOTAKBANK"],
  IT: ["TCS", "INFY", "HCLTECH", "WIPRO", "TECHM", "LTIM"],
  OIL_GAS: ["RELIANCE", "ONGC", "BPCL", "HINDPETRO"],
  PAINTS: ["ASIANPAINT", "BERGEPAINT"],
  AUTOS: ["TATAMOTORS", "MARUTI", "M&M", "EICHERMOT"],
  CONSUMER: ["HINDUNILVR", "ITC", "NESTLEIND", "BRITANNIA"]
};

const SOURCE_CREDIBILITY = {
  "Reuters": 1.0,
  "Bloomberg": 1.0,
  "Economic Times": 0.9,
  "MoneyControl": 0.85,
  "Yahoo Finance": 0.8,
  "Terminal Network": 0.5 // Default/Internal
};

/**
 * PHASE 4 — CROSS-ASSET LOGIC
 * Maps macro transitions to sector impacts
 */
const getMacroImpact = (text) => {
  const t = text.toUpperCase();
  
  if (t.includes("CRUDE OIL") || t.includes("BRENT")) {
    if (t.includes("DOWN") || t.includes("FALL") || t.includes("DROP") || t.includes("LOWER")) {
      return { sector: "PAINTS", impact: "BULLISH", why: "Lower input costs (crude derivatives) improve margins for Paint manufacturers." };
    }
    if (t.includes("UP") || t.includes("RISE") || t.includes("SURGE") || t.includes("HIGHER")) {
      return { sector: "OIL_GAS", impact: "BULLISH", why: "Higher crude prices typically improve realizations for extraction companies (ONGC/Reliance)." };
    }
  }

  if (t.includes("USD") || t.includes("DOLLAR") || t.includes("RUPEE")) {
     if (t.includes("USD RISE") || t.includes("DOLLAR STRENGTHENS") || t.includes("RUPEE FALLS")) {
        return { sector: "IT", impact: "BULLISH", why: "Weakening Rupee increases export realizations for IT offshore service providers." };
     }
  }

  if (t.includes("REBP") || t.includes("INTEREST RATE") || t.includes("RBI")) {
    if (t.includes("HIKE") || t.includes("RISE")) {
       return { sector: "BANKING", impact: "MIXED", why: "Rate hikes improve Net Interest Margins (NIMs) but may dampen credit growth." };
    }
  }

  return null;
};

/**
 * CORE IMPACT CALCULATION
 */
const calculateImpactState = (headline, summary, relevance, source) => {
  const text = `${headline} ${summary}`.toUpperCase();
  
  // 1. Check for Macro Signals first (Cross-Asset Logic)
  const macro = getMacroImpact(text);
  
  // 2. Rule-based Sentiment Analysis
  const posTerms = ["PROFIT", "GROWTH", "BUY", "OUTPERFORM", "BEAT", "UPGRADE", "ORDER WIN", "SUCCESS", "SURGE"];
  const negTerms = ["LOSS", "DECLINE", "SELL", "UNDERPERFORM", "MISS", "DOWNGRADE", "STRIKE", "PROBE", "FINES"];

  const posMatches = posTerms.filter(w => text.includes(w));
  const negMatches = negTerms.filter(w => text.includes(w));

  let sentiment = "NEUTRAL";
  let clarity = 0; 

  if (posMatches.length > negMatches.length) {
    sentiment = "BULLISH";
    clarity = Math.min(40 + (posMatches.length * 15), 100);
  } else if (negMatches.length > posMatches.length) {
    sentiment = "BEARISH";
    clarity = Math.min(40 + (negMatches.length * 15), 100);
  } else if (macro) {
    sentiment = macro.impact;
    clarity = 75; // Macro overrides have higher inherent clarity
  }

  // 3. Significance / Strength (Phase 2)
  const strengthMap = { "HIGH": 100, "MEDIUM": 70, "LOW": 45 };
  const strengthValue = strengthMap[relevance] || 45;

  // 4. Source Credibility (Phase 3)
  const cred = SOURCE_CREDIBILITY[source] || 0.6;

  // 5. Normalization Logic (Phase 3)
  // Weighted: Relevance(40%) + Clarity(35%) + Source(25%)
  const confidence = (strengthValue * 0.4) + (clarity * 0.35) + (cred * 100 * 0.25);

  // 6. Explanation Construction (Phase 6)
  let why = "";
  if (macro) {
    sentiment = macro.impact;
    why = macro.why;
  } else if (sentiment === "BULLISH") {
    why = `Positive momentum detected via terms: [${posMatches.join(", ")}]. ${relevance === 'HIGH' ? 'Critical direct impact on stock equity.' : 'Sector-wide positive sentiment.'}`;
  } else if (sentiment === "BEARISH") {
    why = `System detected exposure to: [${negMatches.join(", ")}]. Suggests capital protection or defensive stance.`;
  } else {
    why = "Neutral transmission. Information does not contain high-probability technical directional triggers.";
  }

  return {
    sentiment,
    confidence: Math.round(confidence),
    strength: relevance,
    explanation: why
  };
};

module.exports = { calculateImpactState, SECTOR_MAP };
