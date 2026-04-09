/**
 * Computes the Relative Strength Index (RSI) for a given series of prices.
 * @param {Array} data Array of price objects { price: number, ... }
 * @param {number} period The RSI period (default 14)
 * @returns {Array} Data with attached 'rsi' values
 */
export const calculateRSI = (data, period = 14) => {
  if (!data || data.length < period) return data.map(d => ({ ...d, rsi: null }));

  let gains = [];
  let losses = [];

  // 1. Calculate daily changes
  for (let i = 1; i < data.length; i++) {
    const change = data[i].price - data[i - 1].price;
    gains.push(change > 0 ? change : 0);
    losses.push(change < 0 ? Math.abs(change) : 0);
  }

  const results = [...data];
  results[0].rsi = null; // First element has no RSI

  // 2. Initial averages (SMA)
  let avgGain = gains.slice(0, period).reduce((a, b) => a + b, 0) / period;
  let avgLoss = losses.slice(0, period).reduce((a, b) => a + b, 0) / period;

  // Set the first RSI value at index 'period'
  const firstRS = avgLoss === 0 ? 100 : avgGain / avgLoss;
  results[period].rsi = 100 - 100 / (1 + firstRS);

  // 3. Smooth the rest of the values (Wilder's Smoothing)
  for (let i = period + 1; i < data.length; i++) {
    const currentGain = gains[i - 1];
    const currentLoss = losses[i - 1];

    avgGain = (avgGain * (period - 1) + currentGain) / period;
    avgLoss = (avgLoss * (period - 1) + currentLoss) / period;

    const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
    results[i].rsi = Number((100 - 100 / (1 + rs)).toFixed(2));
  }

  return results;
};

/**
 * Assigns colors to volume bars based on price movement.
 * @param {Array} data Array of price objects { price: number, ... }
 * @returns {Array} Data with attached 'volumeColor'
 */
export const calculateVolumeColors = (data) => {
  if (!data || data.length === 0) return [];
  
  return data.map((d, index) => {
    if (index === 0) return { ...d, volumeColor: "#10b981" }; // Default green for first bar
    
    // Green if current price >= previous price, else Red
    const isUp = d.price >= data[index - 1].price;
    return {
      ...d,
      volumeColor: isUp ? "#10b981" : "#f43f5e"
    };
  });
};

/**
 * Deterministic color mapping for Risk Scores.
 * @param {number} score Risk score (0-100)
 * @returns {string} HEX color string
 */
export const getRiskColor = (score) => {
  if (typeof score !== 'number') return "#94a3b8"; // Slate (Neutral)
  if (score > 70) return "#f43f5e"; // Rose (High Risk)
  if (score < 40) return "#10b981"; // Emerald (Low Risk)
  return "#f59e0b"; // Amber (Medium Risk)
};
