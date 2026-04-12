const { GoogleGenerativeAI } = require("@google/generative-ai");

/**
 * LAYER 1: AI EXTRACTOR
 * Goal: Extract structured signals from raw text.
 * Fallback: Uses keyword extraction if AI fails or key is missing.
 */

const KEYWORD_MAP = {
  sectors: {
    IT: ["TCS", "INFY", "WIPRO", "HCLTECH", "TECHM", "SOFTWARE", "CLOUD", "AI"],
    BANKING: ["HDFCBANK", "ICICIBANK", "SBIN", "AXISBANK", "KOTAKBANK", "RBI", "RATE", "LOAN"],
    PAINTS: ["ASIANPAINT", "BERGEPAINT", "KANSAINER", "INDIGOPNTS"],
    CONSUMER: ["HINDUNILVR", "ITC", "NESTLE", "BRITANNIA"],
    INFRA: ["L&T", "ADANIENT", "DLF", "CEMENT"]
  },
  macro: {
    OIL: ["CRUDE", "BRENT", "WTI", "ENERGY"],
    USD: ["DOLLAR", "RUPEE", "INR", "EXCHANGE RATE"],
    RATES: ["INTEREST RATE", "RBI", "REPO", "FED", "HIKE"]
  }
};

const keywordFallback = (text) => {
  const t = text.toUpperCase();
  let sector = "GENERAL";
  let macroSignal = "NONE";
  
  for (const [s, words] of Object.entries(KEYWORD_MAP.sectors)) {
    if (words.some(w => t.includes(w))) sector = s;
  }
  for (const [m, words] of Object.entries(KEYWORD_MAP.macro)) {
    if (words.some(w => t.includes(w))) macroSignal = m;
  }

  return {
    entities: [],
    sector,
    eventType: t.includes("PROFIT") || t.includes("EARNINGS") ? "EARNINGS" : "GENERAL",
    sentiment: t.includes("PROFIT") || t.includes("UP") || t.includes("BUY") ? "POSITIVE" : (t.includes("LOSS") || t.includes("DOWN") ? "NEGATIVE" : "NEUTRAL"),
    macroSignal,
    confidence: 60 // Lower confidence for fallback
  };
};

const extractSignals = async (headline, summary) => {
  if (!process.env.GEMINI_API_KEY) {
    return keywordFallback(`${headline} ${summary}`);
  }

  const prompt = `Extract structured financial signals.
    News: ${headline}
    Context: ${summary}
    Extract JSON ONLY:
    {
      "entities": [],
      "sector": "",
      "eventType": "EARNINGS / REGULATORY / MACRO / CORPORATE",
      "sentiment": "POSITIVE / NEGATIVE / NEUTRAL",
      "macroSignal": "OIL / USD / RATES / NONE",
      "confidence": 0-100
    }
    Rules: VALID JSON ONLY. Do NOT add extra text.`;

  try {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ 
      model: "gemini-1.5-flash",
      generationConfig: { responseMimeType: "application/json" }
    });
    
    // Safety Timeout
    const result = await Promise.race([
      model.generateContent(prompt),
      new Promise((_, reject) => setTimeout(() => reject(new Error("AI_TIMEOUT")), 4000))
    ]);

    return JSON.parse(result.response.text());
  } catch (err) {
    console.warn("[Intelligence:AI] Falling back to keyword engine:", err.message);
    return keywordFallback(`${headline} ${summary}`);
  }
};

module.exports = { extractSignals };
