/**
 * Converts a standard ticker symbol (e.g. RELIANCE.NS) to a Mongoose Map safe key.
 * Mongoose Maps do not support dots (.) in keys.
 */
const toSafeKey = (symbol) => {
  if (!symbol) return "";
  return symbol.replace(/\./g, "_");
};

/**
 * Reverts a Mongoose Map safe key back to a standard ticker symbol.
 */
const fromSafeKey = (key) => {
  if (!key) return "";
  return key.replace(/_/g, ".");
};

module.exports = { toSafeKey, fromSafeKey };
