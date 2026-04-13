/**
 * SAFE AI RESPONSE PARSER
 * Tolerates real-world LLM output: backtick wrappers, inline text, nested markdown.
 * NEVER throws. NEVER crashes the calling service.
 */
const safeParseAIResponse = (text) => {
  if (!text || typeof text !== 'string') {
    return { status: "UNAVAILABLE", error: "EMPTY_RESPONSE" };
  }

  // Attempt 1: direct parse (fastest, works when model returns clean JSON)
  try {
    return JSON.parse(text);
  } catch (_) {}

  // Attempt 2: strip ALL backtick wrappers (handles ```json ... ```, ``` ... ```, inline backticks)
  try {
    const cleaned = text
      .replace(/```json/gi, "") // strip ```json (case-insensitive)
      .replace(/```/g, "")      // strip remaining ``` fences
      .replace(/`/g, "")        // strip stray backticks
      .trim();
    return JSON.parse(cleaned);
  } catch (_) {}

  // Attempt 3: extract first { ... } or [ ... ] block from mixed text response
  try {
    const objectMatch = text.match(/\{[\s\S]*\}/);
    if (objectMatch) return JSON.parse(objectMatch[0]);
  } catch (_) {}

  try {
    const arrayMatch = text.match(/\[[\s\S]*\]/);
    if (arrayMatch) return JSON.parse(arrayMatch[0]);
  } catch (_) {}

  return { status: "UNAVAILABLE", error: "INVALID_AI_RESPONSE" };
};

module.exports = { safeParseAIResponse };
