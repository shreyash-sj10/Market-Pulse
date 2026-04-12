/**
 * LAYER 2: RULE ENGINE
 * Modular financial logic mapping for macro/event impact.
 */

const RULES = {
  macro: {
    OIL: {
      DOWN: { adjust: 1, reasoning: "Lower crude input costs improve margins for Paint and Aviation sectors.", targetSectors: ["PAINTS", "AVIATION"] },
      UP: { adjust: -1, reasoning: "Rising crude costs pressure operating margins for logistics and consumption-driven sectors.", targetSectors: ["PAINTS", "AVIATION", "LOGISTICS"] }
    },
    RATES: {
      HIKE: { adjust: -0.5, reasoning: "Rate hikes increase borrowing costs for NBFCs and Real Estate, though Banking NIMs may improve.", targetSectors: ["NBFC", "REAL_ESTATE", "BANKING"] },
      CUT: { adjust: 1, reasoning: "Lower interest rates stimulate credit demand for Auto and Real Estate sectors.", targetSectors: ["AUTO", "REAL_ESTATE", "NBFC"] }
    },
    USD: {
      UP: { adjust: 0.8, reasoning: "USD strength boosts export-led realisations for IT and Pharma exporters.", targetSectors: ["IT", "PHARMA"] },
      DOWN: { adjust: -0.5, reasoning: "USD weakness may dampen offshore margins for major service exporters.", targetSectors: ["IT"] }
    }
  },
  events: {
    EARNINGS: {
      POSITIVE: { adjust: 1, reasoning: "Positive earnings trajectory signals fundamental strength and potential re-rating." },
      NEGATIVE: { adjust: -1, reasoning: "Earnings miss indicates operational headwinds or slowing growth." }
    }
  }
};

const applyRules = (signals, text) => {
  const t = text.toUpperCase();
  const reasoning = [];
  let impactMod = 0;

  // 1. Apply Macro Rules
  if (signals.macroSignal && RULES.macro[signals.macroSignal]) {
    const direction = (t.includes("UP") || t.includes("RISE") || t.includes("HIGH") || t.includes("HIKE")) ? "UP" : 
                      (t.includes("DOWN") || t.includes("FALL") || t.includes("CUT") || t.includes("LOW")) ? "DOWN" : null;
    
    if (direction && RULES.macro[signals.macroSignal][direction]) {
      const rule = RULES.macro[signals.macroSignal][direction];
      impactMod += rule.adjust;
      reasoning.push(rule.reasoning);
    }
  }

  // 2. Apply Event Rules
  if (signals.eventType && RULES.events[signals.eventType]) {
    const sentiment = signals.sentiment === "POSITIVE" ? "POSITIVE" : (signals.sentiment === "NEGATIVE" ? "NEGATIVE" : null);
    if (sentiment && RULES.events[signals.eventType][sentiment]) {
      const rule = RULES.events[signals.eventType][sentiment];
      impactMod += rule.adjust;
      reasoning.push(rule.reasoning);
    }
  }

  // Ensure default reasoning if empty
  if (reasoning.length === 0) {
    reasoning.push(`System detected ${signals.sentiment.toLowerCase()} sentiment from ${signals.sector.toLowerCase()} signals.`);
  }

  return { impactMod, reasoning };
};

module.exports = { applyRules };
