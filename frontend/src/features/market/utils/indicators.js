/**
 * Calculates the Exponential Moving Average (EMA) for a series of prices.
 * @param {number[]} prices - Array of closing prices.
 * @param {number} period - EMA period (usually 20).
 * @returns {number} The latest EMA value.
 */
export const calculateEMA = (prices, period = 20) => {
  if (!prices || prices.length < period) return null;

  const k = 2 / (period + 1);
  let ema = prices.slice(0, period).reduce((acc, val) => acc + val, 0) / period;

  for (let i = period; i < prices.length; i++) {
    ema = (prices[i] * k) + (ema * (1 - k));
  }

  return Number(ema.toFixed(2));
};

/**
 * Calculates the Relative Strength Index (RSI) for a series of prices.
 * @param {number[]} prices - Array of closing prices.
 * @param {number} period - RSI period (usually 14).
 * @returns {number} The latest RSI value.
 */
export const calculateRSI = (prices, period = 14) => {
  if (!prices || prices.length < period + 1) return 50;

  let gains = 0;
  let losses = 0;

  for (let i = 1; i <= period; i++) {
    const diff = prices[i] - prices[i - 1];
    if (diff >= 0) gains += diff;
    else losses -= diff;
  }

  let avgGain = gains / period;
  let avgLoss = losses / period;

  for (let i = period + 1; i < prices.length; i++) {
    const diff = prices[i] - prices[i - 1];
    const currentGain = diff >= 0 ? diff : 0;
    const currentLoss = diff < 0 ? -diff : 0;

    avgGain = (avgGain * (period - 1) + currentGain) / period;
    avgLoss = (avgLoss * (period - 1) + currentLoss) / period;
  }

  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return Number((100 - (100 / (1 + rs))).toFixed(2));
};

/**
 * Determines if the recent volume is high compared to a 10-day average.
 */
export const getVolumeStatus = (volumes) => {
  if (!volumes || volumes.length < 10) return "Normal";
  
  const recentVolume = volumes[volumes.length - 1];
  const last10 = volumes.slice(-11, -1);
  const avgVolume = last10.reduce((a, b) => a + b, 0) / last10.length;

  if (recentVolume > avgVolume * 2) return "Extreme";
  if (recentVolume > avgVolume * 1.5) return "High";
  return "Normal";
};

/**
 * Generates a deterministic insight based on simple rule-based logic.
 */
export const generateInsight = (currentPrice, ema, rsi, volumeStatus) => {
  if (!ema || !rsi) return "Insufficient data for detailed analysis.";

  const isAboveEMA = currentPrice > ema;
  const volumeSuffix = volumeStatus === "High" || volumeStatus === "Extreme" 
    ? " with strong volume confirmation." 
    : ".";

  if (isAboveEMA && rsi > 70) return `Strong uptrend but entering overbought territory — high risk entry${volumeSuffix}`;
  if (isAboveEMA && rsi < 70) return `Consistent uptrend with healthy momentum — potential buy zone${volumeSuffix}`;
  if (!isAboveEMA && rsi < 30) return `Extended downtrend nearing oversold levels — possible reversal area${volumeSuffix}`;
  if (!isAboveEMA && rsi > 30) return `Bearish pressure mounting — wait for EMA recovery${volumeSuffix}`;

  return "Market is in a neutral consolidation phase.";
};
