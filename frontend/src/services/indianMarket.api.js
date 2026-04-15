import api from "./api";
import { normalizeResponse } from "../utils/contract.js";

// ─── Symbol Normalisation ─────────────────────────────────────────────────────
// Our backend handles the .NS/.BO suffixes natively.
const toApiSymbol = (symbol) => {
  if (!symbol) return symbol;
  const s = symbol.toUpperCase();
  if (s.endsWith(".NS") || s.endsWith(".BO")) return s;
  return s; // The backend service will add .NS if it's missing
};

// ─── Single Stock Full Detail ─────────────────────────────────────────────────
export const getIndianStockDetail = async (symbol) => {
  try {
    const res = await api.get(`/market/stock/${toApiSymbol(symbol)}`);
    return normalizeResponse(res); 
  } catch (error) {
    console.error(`[Frontend API] Detail fetch failed for ${symbol}:`, error.message);
    return null;
  }
};

// ─── Single Stock Price Only ──────────────────────────────────────────────────
export const getIndianStockPrice = async (symbol) => {
  const detail = await getIndianStockDetail(symbol);
  const directPrice = detail?.data?.pricePaise ?? detail?.data?.last_price ?? detail?.last_price;
  return directPrice ?? null;
};

// ─── Batch Fetch ─────────────────────────────────────────────────────────────
export const getIndianStockBatch = async (symbols) => {
  if (!symbols || symbols.length === 0) return {};

  try {
    const apiSymbols = symbols.map(toApiSymbol).join(",");
    const res = await api.get(`/market/batch?symbols=${apiSymbols}`);
    return normalizeResponse(res);
  } catch (error) {
    console.error('[Frontend API] Batch fetch failed:', error.message);
    return {};
  }
};

// ─── Search Stocks ────────────────────────────────────────────────────────────
export const searchIndianStocks = async (query) => {
  if (!query) return [];
  try {
    const res = await api.get(`/market/search?q=${query}`);
    return normalizeResponse(res);
  } catch (error) {
    console.error('[Frontend API] Search failed:', error.message);
    return [];
  }
};
