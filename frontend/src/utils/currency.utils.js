import axios from 'axios';

let currentExchangeRate = 83.5; // Fallback rate

/**
 * PRODUCTION-GRADE CURRENCY PROTOCOL
 * Synchronizes with global exchange rates and provides integer-safe (Paise) formatting.
 */

export const initCurrency = async () => {
  try {
    const res = await axios.get('https://api.exchangerate-api.com/v4/latest/USD');
    if (res.data?.rates?.INR) {
      currentExchangeRate = res.data.rates.INR;
      console.log(`[Currency] Global Sync Successful: 1 USD = ${currentExchangeRate} INR`);
    }
  } catch (error) {
    console.warn('[Currency] Sync failed. Reverting to hard-coded fallback (83.5)');
  }
};

export const fromPaise = (paise) => (paise || 0) / 100;
export const toPaise = (rupees) => Math.round((parseFloat(rupees) || 0) * 100);

/**
 * Formats a number as Indian Rupees (INR)
 * @param {number} paise - The price in Paise (must be an integer)
 */
export const formatINR = (paise) => {
  if (paise === undefined || paise === null || isNaN(paise)) {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 2
    }).format(0);
  }

  const amount = (paise / 100);

  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2
  }).format(amount);
};

export const getExchangeRate = () => currentExchangeRate;

/**
 * Financial Delta Styling
 */
export const getPriceColor = (change) => {
  if (change > 0) return "text-emerald-500";
  if (change < 0) return "text-rose-500";
  return "text-slate-400";
};

// Auto-init on launch
initCurrency();
