/**
 * Map Yahoo `summaryProfile.sector` (English) to an NSE sector / broad index
 * for same-day % alignment with scanner `changePercent` (regular session).
 * First matching regex wins; last entry is broad fallback.
 */
const ENTRIES = [
  { re: /bank|financial services|financial|insurance/i, symbol: "^NSEBANK", label: "Bank Nifty" },
  { re: /software|information technology|technology/i, symbol: "^CNXIT", label: "Nifty IT" },
  { re: /pharma|healthcare|biotech/i, symbol: "^CNXPHARMA", label: "Nifty Pharma" },
  { re: /auto|vehicles/i, symbol: "^CNXAUTO", label: "Nifty Auto" },
  { re: /metal|steel|mining|basic materials/i, symbol: "^CNXMETAL", label: "Nifty Metal" },
  { re: /energy|oil|gas|petroleum/i, symbol: "^CNXENERGY", label: "Nifty Energy" },
  { re: /fmcg|consumer defensive|food|beverage|tobacco/i, symbol: "^CNXFMCG", label: "Nifty FMCG" },
  { re: /real estate|reit/i, symbol: "^CNXREALTY", label: "Nifty Realty" },
  { re: /media|entertainment|communication/i, symbol: "^NSEI", label: "Nifty 50" },
  { re: /consumer cyclical|retail|textile|apparel/i, symbol: "^NSEI", label: "Nifty 50" },
  { re: /industrial|capital goods|engineering|aerospace/i, symbol: "^NSEI", label: "Nifty 50" },
  { re: /utility|utilities|power/i, symbol: "^NSEI", label: "Nifty 50" },
  { re: /./, symbol: "^NSEI", label: "Nifty 50" },
];

/**
 * @param {string | null | undefined} sector
 * @returns {{ symbol: string, label: string } | null}
 */
function resolveSectorBenchmark(sector) {
  if (!sector || typeof sector !== "string") return null;
  const s = sector.trim();
  if (!s) return null;
  for (const { re, symbol, label } of ENTRIES) {
    if (re.test(s)) return { symbol, label };
  }
  return { symbol: "^NSEI", label: "Nifty 50" };
}

module.exports = { resolveSectorBenchmark, ENTRIES };
