import axios from 'axios';

let exchangeRate = 83.5; // Fallback rate

// Fetch live conversion rate once on load
export const initCurrency = async () => {
  try {
    const res = await axios.get('https://api.exchangerate-api.com/v4/latest/USD');
    if (res.data?.rates?.INR) {
      exchangeRate = res.data.rates.INR;
      console.log(`[Currency] Live rate updated: 1 USD = ${exchangeRate} INR`);
    }
  } catch (error) {
    console.warn('[Currency] Failed to fetch live rate, using fallback:', exchangeRate);
  }
};

/**
 * Formats a number as Indian Rupees (INR)
 * @param {number} value - The price to format
 * @param {boolean} isUSD - If true, converts from USD to INR first
 */
export const formatINR = (value, isUSD = false) => {
  const amount = isUSD ? value * exchangeRate : value;
  
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2
  }).format(amount);
};

export const getExchangeRate = () => exchangeRate;

// Initialize on import (optional, or call in App.jsx)
initCurrency();
