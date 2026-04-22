import axios from "axios";

let currentExchangeRate = Number(import.meta.env.VITE_DEFAULT_USD_INR || NaN);
let currencyStatus = {
  isFallback: Number.isFinite(currentExchangeRate),
  isSynthetic: false,
  source: Number.isFinite(currentExchangeRate) ? "ENV_DEFAULT" : "UNAVAILABLE",
};

export const initCurrency = async () => {
  try {
    const res = await axios.get("https://api.exchangerate-api.com/v4/latest/USD");
    if (res.data?.rates?.INR) {
      currentExchangeRate = Number(res.data.rates.INR);
      currencyStatus = { isFallback: false, isSynthetic: false, source: "LIVE_API" };
      return currencyStatus;
    }
    throw new Error("INR_RATE_NOT_FOUND");
  } catch {
    if (Number.isFinite(currentExchangeRate)) {
      currencyStatus = { isFallback: true, isSynthetic: false, source: "ENV_DEFAULT" };
      console.warn("[Currency] Live sync failed. Using explicit ENV fallback rate.");
      return currencyStatus;
    }
    currencyStatus = { isFallback: true, isSynthetic: false, source: "UNAVAILABLE" };
    throw new Error("CURRENCY_RATE_UNAVAILABLE");
  }
};

export const fromPaise = (paise) => (paise || 0) / 100;
export const toPaise = (rupees) => Math.round((parseFloat(rupees) || 0) * 100);

/**
 * PROTOCOL ENFORCEMENT: ALL_INTERNAL_VALUES = INTEGER_PAISE
 * This function is the ONLY place where division by 100 occurs for display.
 */
export const formatINR = (paise) => {
  const val = Number(paise);
  if (!Number.isFinite(val)) return "₹0.00";

  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(val / 100);
};

/**
 * Signed INR formatter for P&L-like values.
 * - Positive: "+₹X"
 * - Negative: "-₹X" (from Intl formatter)
 * - Zero:     "₹0.00" by default (or +₹0.00 when opted in)
 */
export const formatSignedINR = (paise, options = {}) => {
  const val = Number(paise);
  if (!Number.isFinite(val)) return "₹0.00";

  const { showPlusForZero = false } = options;
  if (val > 0) return `+${formatINR(val)}`;
  if (val < 0) return formatINR(val);
  return showPlusForZero ? `+${formatINR(0)}` : formatINR(0);
};

export const getExchangeRate = () => {
  if (!Number.isFinite(currentExchangeRate)) {
    throw new Error("CURRENCY_RATE_UNAVAILABLE");
  }
  return currentExchangeRate;
};

export const getCurrencyStatus = () => ({ ...currencyStatus });

export const getPriceColor = (change) => {
  if (change > 0) return "text-emerald-500";
  if (change < 0) return "text-rose-500";
  return "text-slate-400";
};

initCurrency().catch(() => {
  console.warn("[Currency] Live and ENV exchange rates unavailable.");
});
