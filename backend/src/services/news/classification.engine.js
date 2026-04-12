const SOURCE_WEIGHTS = {
  "REUTERS": 40,
  "BLOOMBERG": 40,
  "ECONOMIC TIMES": 35,
  "MONEYCONTROL": 30,
  "YAHOO FINANCE": 25,
  "FINNHUB": 25,
  "TERMINAL NETWORK": 15
};

const SECTOR_KEYWORDS = {
  BANKING: ["repo rate", "rbi hike", "interest rate", "nbfc", "credit growth", "hdfc bank", "icici bank", "sbi loans"],
  ENERGY: ["crude brent", "oil barrel", "petrol prices", "diesel hike", "gas pipeline", "reliance industries", "ongc"],
  AVIATION: ["aviation turbine fuel", "atf cost", "indigo airlines", "spicejet", "air travel demand"],
  PAINT: ["asian paints", "berger paints", "titanium dioxide", "crude derivatives"],
  IT: ["software services", "cloud computing", "saas", "tcs results", "infosys earnings", "wipro contract", "nasdaq tech"],
  INFRA: ["infrastructure", "cement production", "road construction", "bridge project", "lt order", "ultratech"],
  AUTO: ["passenger vehicle", "car sales", "maruti suzuki", "tata motors", "mahindra ev", "two wheeler"],
  FMCG: ["consumer goods", "hul", "itc", "nestle", "fmcg sales", "rural demand"]
};

const SECTOR_IMAGES = {
  BANKING: [
    "https://images.unsplash.com/photo-1501167786227-4cba60f6d58f?auto=format&fit=crop&q=80&w=1000",
    "https://images.unsplash.com/photo-1601597111158-2fcee29a1ee5?auto=format&fit=crop&q=80&w=1000"
  ],
  ENERGY: [
    "https://images.unsplash.com/photo-1548705085-101177834f47?auto=format&fit=crop&q=80&w=1000",
    "https://images.unsplash.com/photo-1516937622178-745583720b29?auto=format&fit=crop&q=80&w=1000"
  ],
  IT: [
    "https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&q=80&w=1000",
    "https://images.unsplash.com/photo-1461749280684-dccba630e2f6?auto=format&fit=crop&q=80&w=1000"
  ],
  AUTO: [
    "https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?auto=format&fit=crop&q=80&w=1000",
    "https://images.unsplash.com/photo-1503376780353-7e6692767b70?auto=format&fit=crop&q=80&w=1000"
  ],
  FMCG: [
    "https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&q=80&w=1000",
    "https://images.unsplash.com/photo-1604719312563-8912e9223c6a?auto=format&fit=crop&q=80&w=1000"
  ],
  GENERAL: [
    "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&q=80&w=1000",
    "https://images.unsplash.com/photo-1611974714158-f88c146996bd?auto=format&fit=crop&q=80&w=1000"
  ]
};

const getSectorImage = (sector, index = 0) => {
  const images = SECTOR_IMAGES[sector] || SECTOR_IMAGES.GENERAL;
  return images[index % images.length];
};

/**
 * STEP 1 — COUNTRY DETECTION
 */
const detectCountry = (text) => {
  const t = (text || "").toUpperCase();
  const indianKeywords = ["RBI", "NSE", "SEBI", "NIFTY", "SENSEX", "INDIA", "INR", "RUPEE", "MODI", "FINANCE MINISTRY", "LOK SABHA", "RELIANCE", "HDFC", "TATA", "ADANI"];
  
  if (indianKeywords.some(k => t.includes(k))) return "INDIA";
  return "GLOBAL";
};

/**
 * STEP 2 — RELEVANCE ENGINE
 */
const getRelevance = (symbol, text, userHoldings = {}) => {
  const t = (text || "").toUpperCase();
  const normSymbol = (symbol || "").toUpperCase().split(".")[0];
  
  if (t.includes(normSymbol) || userHoldings[normSymbol]) return "DIRECT";

  for (const [sector, keywords] of Object.entries(SECTOR_KEYWORDS)) {
    if (keywords.some(k => t.includes(k.toUpperCase()))) return "INDIRECT";
  }

  const macroKeywords = ["FED", "USD", "GDP", "INFLATION", "TREASURY", "OIL", "COMMODITY", "REBP", "HIKE", "WAR", "GEOPOLITICS", "TRADE", "GLOBAL"];
  if (macroKeywords.some(k => t.includes(k))) return "MACRO";

  return "MACRO"; 
};

/**
 * STEP 3 — SECTOR MAPPING
 */
const mapSector = (text) => {
  const t = (text || "").toUpperCase();
  for (const [sector, keywords] of Object.entries(SECTOR_KEYWORDS)) {
    if (keywords.some(k => t.includes(k.toUpperCase()))) return sector;
  }
  return "GENERAL";
};

/**
 * SIGNAL GENERATION Logic (DECISION ENGINE MODE)
 */
const generateSignal = (headline, summary, relevance, country, itemMetadata = {}, hasAI = false) => {
  const text = `${headline} ${summary || ""}`.toUpperCase();
  const { source, time } = itemMetadata;
  
  const posTerms = ["PROFIT", "GROWTH", "BEAT", "UPGRADE", "ORDER", "SURGE", "RECOVERY", "STRENGTH", "SUCCESS", "ACQUISITION", "POSITIVE", "BULLISH"];
  const negTerms = ["LOSS", "DECLINE", "MISS", "DOWNGRADE", "STRIKE", "FINE", "PROBE", "PRESSURE", "VOLATILITY", "WAR", "NEGATIVE", "BEARISH"];

  const posCount = posTerms.filter(w => text.includes(w)).length;
  const negCount = negTerms.filter(w => text.includes(w)).length;

  let impact = "NEUTRAL";
  let verdict = "WAIT"; // Default verdict
  const scope = relevance === "DIRECT" ? "STOCK" : relevance === "INDIRECT" ? "SECTOR" : "MARKET";
  const sector = mapSector(text);
  
  const event = headline.split(' ').slice(0, 8).join(' ');
  let mechanism = "System monitoring systemic noise for directional triggers.";
  let judgment = "Maintaining baseline exposure. No high-impact vector detected.";

  if (posCount > negCount) {
    impact = "BULLISH";
    verdict = relevance === "DIRECT" ? "BUY" : "CAUTION";
    mechanism = `${scope} exhibiting forward momentum via ${posTerms.find(w => text.includes(w)) || 'growth'} catalysts.`;
    judgment = `${relevance === "DIRECT" ? 'Aggressive' : 'Selectively optimistic'} exposure suggested for ${scope} nodes.`;
  } else if (negCount > posCount) {
    impact = "BEARISH";
    verdict = relevance === "DIRECT" ? "AVOID" : "WAIT";
    mechanism = `${scope} facing structural pressure from ${negTerms.find(w => text.includes(w)) || 'downside'} risk factors.`;
    judgment = `Defensive rotation recommended. Reduce exposure to ${scope} beta.`;
  }

  // Institutional Confidence Formula
  const sourceWeight = SOURCE_WEIGHTS[source?.toUpperCase()] || 15;
  const keywordStrength = Math.min((posCount + negCount) * 10, 40);
  const hrsOld = Math.max(0, (Date.now() - new Date(time).getTime()) / (1000 * 60 * 60));
  const recencyWeight = Math.max(0, 10 - (hrsOld * 2));

  let confidence = Math.round(sourceWeight + keywordStrength + recencyWeight);
  if (!hasAI) confidence = Math.min(Math.round(confidence * 0.8), 75);
  confidence = Math.max(confidence, 40);

  return {
    impact,
    confidence,
    scope,
    sector,
    event: `${event}...`,
    mechanism,
    judgment,
    verdict,
    country
  };
};

module.exports = {
  detectCountry,
  getRelevance,
  mapSector,
  generateSignal,
  getSectorImage
};
