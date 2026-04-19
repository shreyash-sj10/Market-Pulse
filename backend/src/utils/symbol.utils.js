/**
 * NSE/BSE-style symbol normalisation for holdings, trades, and Yahoo batch quotes.
 * Indian symbols without an exchange suffix default to `.NS`.
 */
function normalizeSymbol(symbol) {
  if (symbol == null) return symbol;
  const s = String(symbol).trim();
  if (s === "") return null;
  const u = s.toUpperCase();
  if (u.endsWith(".NS") || u.endsWith(".BO")) return u;
  return `${u}.NS`;
}

/**
 * Yahoo Finance symbol rules: indices (^), futures (=F), FX (=X), and dotted symbols pass through unchanged.
 */
function toYahooSymbol(symbol) {
  if (symbol == null || symbol === "") return "";
  const s = String(symbol).toUpperCase().trim();
  if (s.startsWith("^") || s.includes(".") || s.endsWith("=F") || s.endsWith("=X")) return s;
  return `${s}.NS`;
}

module.exports = { normalizeSymbol, toYahooSymbol };
