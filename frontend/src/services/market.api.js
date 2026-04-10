import axios from "axios";
import api from "./api.js";
import { getIndianStockPrice } from "./indianMarket.api.js";
import { formatINR, getExchangeRate } from "../utils/currency.utils.js";

// Finnhub is used for US stocks and historical sparklines
const FINNHUB_KEY = import.meta.env.VITE_FINNHUB_API_KEY;

const isIndianSymbol = (symbol) =>
  symbol?.endsWith(".NS") || symbol?.endsWith(".BO");

// ─── Dynamic Market Discovery ──────────────────────────────────────────────
// Fetches the latest Nifty 200 constituents from a public data source.
// This ensures the "Market Explorer" is always up-to-date.
export const fetchNiftyConstituents = async () => {
  try {
    const res = await axios.get("https://raw.githubusercontent.com/Anand-Chowdhary/indian-stock-market/master/data/nifty-200.json");
    return res.data.map(item => ({
      symbol: `${item.symbol}.NS`,
      name: `${item.name} (${item.sector})`,
      sector: item.sector
    }));
  } catch (error) {
    console.warn("[MarketAPI] Failed to fetch Nifty list, using fallback.");
    return [
      { symbol: "RELIANCE.NS", name: "Reliance Industries Ltd", sector: "Energy" },
      { symbol: "TCS.NS", name: "Tata Consultancy Services", sector: "IT" },
      { symbol: "HDFCBANK.NS", name: "HDFC Bank Ltd", sector: "Finance" },
      { symbol: "INFY.NS", name: "Infosys Ltd", sector: "IT" },
      { symbol: "ICICIBANK.NS", name: "ICICI Bank Ltd", sector: "Finance" },
      { symbol: "HINDUNILVR.NS", name: "Hindustan Unilever Ltd", sector: "Consumer Goods" },
      { symbol: "ITC.NS", name: "ITC Ltd", sector: "Consumer Goods" },
      { symbol: "SBIN.NS", name: "State Bank of India", sector: "Finance" },
      { symbol: "BHARTIARTL.NS", name: "Bharti Airtel Ltd", sector: "Telecom" },
      { symbol: "KOTAKBANK.NS", name: "Kotak Mahindra Bank Ltd", sector: "Finance" },
      { symbol: "LTIM.NS", name: "LTIMindtree Ltd", sector: "IT" },
      { symbol: "MARUTI.NS", name: "Maruti Suzuki India Ltd", sector: "Automobile" },
      { symbol: "TITAN.NS", name: "Titan Company Ltd", sector: "Consumer Durables" },
      { symbol: "ADANIENT.NS", name: "Adani Enterprises Ltd", sector: "Metals" },
      { symbol: "SUNPHARMA.NS", name: "Sun Pharmaceutical Industries Ltd", sector: "Healthcare" },
      { symbol: "BAJFINANCE.NS", name: "Bajaj Finance Ltd", sector: "Finance" },
      { symbol: "ULTRACEMCO.NS", name: "UltraTech Cement Ltd", sector: "Construction Materials" },
      { symbol: "ASIANPAINT.NS", name: "Asian Paints Ltd", sector: "Consumer Goods" },
      { symbol: "WIPRO.NS", name: "Wipro Ltd", sector: "IT" },
      { symbol: "AXISBANK.NS", name: "Axis Bank Ltd", sector: "Finance" },
      { symbol: "NTPC.NS", name: "NTPC Ltd", sector: "Energy" },
      { symbol: "M&M.NS", name: "Mahindra & Mahindra Ltd", sector: "Automobile" },
      { symbol: "ONGC.NS", name: "Oil & Natural Gas Corporation Ltd", sector: "Energy" },
      { symbol: "ADANIPORTS.NS", name: "Adani Ports & SEZ Ltd", sector: "Services" },
      { symbol: "JSWSTEEL.NS", name: "JSW Steel Ltd", sector: "Metals" },
      { symbol: "TATASTEEL.NS", name: "Tata Steel Ltd", sector: "Metals" },
      { symbol: "POWERGRID.NS", name: "Power Grid Corporation of India Ltd", sector: "Energy" },
      { symbol: "HCLTECH.NS", name: "HCL Technologies Ltd", sector: "IT" },
      { symbol: "COALINDIA.NS", name: "Coal India Ltd", sector: "Energy" },
      { symbol: "BAJAJFINSV.NS", name: "Bajaj Finserv Ltd", sector: "Finance" },
      { symbol: "L&T.NS", name: "Larsen & Toubro Ltd", sector: "Construction" },
      { symbol: "GRASIM.NS", name: "Grasim Industries Ltd", sector: "Diversified" },
      { symbol: "NESTLEIND.NS", name: "Nestle India Ltd", sector: "Consumer Goods" },
      { symbol: "TECHM.NS", name: "Tech Mahindra Ltd", sector: "IT" },
      { symbol: "HINDALCO.NS", name: "Hindalco Industries Ltd", sector: "Metals" },
      { symbol: "INDUSINDBK.NS", name: "IndusInd Bank Ltd", sector: "Finance" },
      { symbol: "SBILIFE.NS", name: "SBI Life Insurance Company Ltd", sector: "Finance" },
      { symbol: "TATARELI.NS", name: "Tata Consumer Products Ltd", sector: "Consumer Goods" },
      { symbol: "DRREDDY.NS", name: "Dr. Reddy's Laboratories Ltd", sector: "Healthcare" },
      { symbol: "EICHERMOT.NS", name: "Eicher Motors Ltd", sector: "Automobile" },
      { symbol: "ADANIPOWER.NS", name: "Adani Power Ltd", sector: "Energy" },
      { symbol: "DLF.NS", name: "DLF Ltd", sector: "Real Estate" },
      { symbol: "VBL.NS", name: "Varun Beverages Ltd", sector: "Consumer Goods" },
      { symbol: "HAL.NS", name: "Hindustan Aeronautics Ltd", sector: "Defense" },
      { symbol: "ZOMATO.NS", name: "Zomato Ltd", sector: "Tech" },
      { symbol: "JIOFIN.NS", name: "Jio Financial Services Ltd", sector: "Finance" },
    ];
  }
};

// ─── High-Fidelity Synthetic Fallback ────────────────────────────────────────
export const generateSimulatedHistory = (currentPrice, isUSD = false, periods = 30) => {
  const rate = getExchangeRate();
  const basePrice = isUSD ? currentPrice * rate : currentPrice;

  const history = [];
  let lastPrice = basePrice || 100;
  const isUpTrend = Math.random() > 0.45;

  for (let i = periods - 1; i >= 0; i--) {
    const timestamp = Math.floor(Date.now() / 1000) - (i * 24 * 60 * 60);
    const dateObj = new Date(timestamp * 1000);

    const drift = isUpTrend ? 0.001 : -0.0005;
    const volatility = 0.012;
    const change = lastPrice * (drift + (Math.random() - 0.5) * volatility);
    const price = Number((lastPrice + change).toFixed(2));
    const volume = Math.floor(Math.random() * 500000) + 100000;

    history.push({
      date: dateObj.toISOString().split("T")[0],
      fullDate: dateObj.toISOString().split("T")[0],
      price,
      volume,
    });
    lastPrice = price;
  }

  return history;
};

// ─── Global Indices (Live from Backend) ──────────────────────────────────
export const getMarketIndices = async () => {
  try {
    const res = await api.get("/market/indices");
    return res.data;
  } catch (error) {
    console.warn("[MarketAPI] Backend indices failed, returning empty state.");
    return [];
  }
};

// ─── Professional Price Fetching (Returns INR) ─────────────────────────────
export const validateSymbol = async (symbol) => {
  if (!symbol) return { isValid: false };
  try {
    const res = await api.get(`/market/validate?symbol=${symbol}`);
    return res.data;
  } catch (error) {
    return { isValid: false };
  }
};

export const getStockPriceINR = async (symbol) => {
  if (!symbol) return null;

  if (isIndianSymbol(symbol)) {
    return getIndianStockPrice(symbol);
  }

  // Handle US stocks via Finnhub + Conversion
  try {
    const res = await axios.get(
      `https://finnhub.io/api/v1/quote?symbol=${symbol}&token=${FINNHUB_KEY}`,
      { timeout: 5000 }
    );
    const usdPrice = res.data.c;
    return usdPrice ? usdPrice * getExchangeRate() : null;
  } catch {
    return null;
  }
};

// ─── Legacy/Compatibility wrapper ──────────────────────────────────────────
export const getStockPrice = getStockPriceINR;

// ─── Professional Historical Data (Backend Source) ──────────────────────────
export const getHistoricalPrices = async (symbol, timeframe = "1mo") => {
  if (!symbol) return { data: [], isSimulated: false };

  try {
    // Map timeframes to Yahoo-compatible periods
    const periodMap = {
      "1D": "1d",
      "1W": "1wk",
      "1M": "1mo",
      "3M": "3mo",
      "1Y": "1y"
    };
    
    const period = periodMap[timeframe] || "1mo";
    const res = await api.get(`/market/history?symbol=${symbol}&period=${period}`);

    if (!res.data || !res.data.success || !res.data.data.prices) {
      throw new Error("Invalid history response");
    }

    // Response structure from backend is { success, data: { prices: [...] } }
    const prices = res.data.data.prices.map(p => ({
      time: p.date, // Backend uses date string
      open: p.open,
      high: p.high,
      low: p.low,
      close: p.close,
      volume: p.volume
    }));

    return { 
      data: prices, 
      isSimulated: false,
      source: res.data.data.source
    };
  } catch (error) {
    console.warn("[MarketAPI] History fetch failed:", error.message);
    return { data: [], isSimulated: false };
  }
};

// ─── Professional Symbol Search ──────────────────────────────────────────
export const searchSymbols = async (query) => {
  if (!query || query.length < 1) return [];

  try {
    const res = await axios.get(
      `https://finnhub.io/api/v1/search?q=${query}&token=${FINNHUB_KEY}`,
      { timeout: 5000 }
    );

    return (res.data.result || [])
      .filter(item => item.type === "Common Stock" || !item.type)
      .map(item => {
        // If it's a bare symbol that doesn't look like a US stock, favor .NS
        let displaySymbol = item.symbol;
        if (!displaySymbol.includes(".") && query.length <= 4) {
          // For simplicity, we just pass what Finnhub gives
        }
        return {
          symbol: item.symbol,
          description: item.description,
          displaySymbol: item.displaySymbol,
        };
      })
      .slice(0, 8);
  } catch {
    return [];
  }
};

// ─── Market Intelligence (Real-time News) ────────────────────────────────────
// ─── Market Explorer (Live Snapshots) ─────────────────────────────────────────
export const getExplorerData = async (limit = 16, offset = 0, query = "") => {
  try {
    const res = await api.get(`/market/explore?limit=${limit}&offset=${offset}&query=${query}`);
    return res.data;
  } catch (error) {
    throw new Error("Market data unavailable");
  }
};

export const getMarketNews = async () => {
  try {
    const res = await api.get("/market/news");

    if (!res.data || res.data.length === 0) throw new Error("Empty news response");

    // We map backend fields (thumbnail, link) to frontend components (image, url)
    return res.data.map(item => ({
      id: item.id || item.uuid,
      title: item.title,
      summary: item.summary,
      source: item.source,
      image: item.thumbnail || item.image,
      url: item.url || item.link,
      time: item.time,
    })).slice(0, 50);
  } catch (error) {
    console.warn("[MarketAPI] Backend news failed, using fallback.", error.message);
    // Robust fallback news system
    return [
      {
        id: "fallback-1",
        title: "Global Equity Markets Show Resilience Amid Volatility",
        summary: "Investors continue to monitor inflation data as global indices remain robust despite macroeconomic headwinds. Central banks maintain a watchful stance on interest rate trajectories.",
        source: "Market Intelligence",
        image: "https://images.unsplash.com/photo-1611974714158-f88c146996bd?auto=format&fit=crop&q=80&w=1000",
        url: "#",
        time: new Date().toISOString()
      },
      {
        id: "fallback-2",
        title: "Tech Sector Leads Sectoral Recovery in Domestic Markets",
        summary: "Blue-chip technology stocks have anchored the market's recovery as institutional investors increase their exposure to cloud and AI-driven service providers.",
        source: "Financial Gazette",
        image: "https://images.unsplash.com/photo-1590283603385-17ffb3a7f29f?auto=format&fit=crop&q=80&w=1000",
        url: "#",
        time: new Date().toISOString()
      },
      {
        id: "fallback-3",
        title: "Commodity Prices Stabilize as Supply Chains Normalize",
        summary: "Energy and base metal prices have retreated from recent highs, offering potential relief for manufacturing sectors and inflation-sensitive assets.",
        source: "Reuters Market",
        image: "https://images.unsplash.com/photo-1526304640581-d334cdbbf45e?auto=format&fit=crop&q=80&w=1000",
        url: "#",
        time: new Date().toISOString()
      }
    ];
  }
};
