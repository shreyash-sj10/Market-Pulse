/**
 * PAISE PROTOCOL ENFORCEMENT UTILITY
 * Invariant: ALL internal monetary values MUST be integers.
 */

/**
 * Ensures a value is a valid integer Paise.
 * Throws error if any float leakage is detected.
 */
const enforcePaise = (value, fieldName = "Value") => {
  if (!Number.isInteger(value)) {
    throw new Error(`[PAISE_VIOLATION] ${fieldName} must be an integer: current value: ${value}`);
  }
  return value;
};

/**
 * Converts any Rupee input to integer Paise at the system gateway.
 * ALWAYS use Math.round to prevent floating point drift.
 */
const toPaise = (rupees) => {
  if (rupees === undefined || rupees === null) return 0;
  return Math.round(parseFloat(rupees) * 100);
};

/**
 * Standard Percentage Calculation for the Paise Protocol.
 * percentage = (paise / paise) * 100
 */
const calculatePct = (pnlPaise, investedPaise) => {
  if (!investedPaise || investedPaise === 0) return 0;
  
  enforcePaise(pnlPaise, "pnlPaise");
  enforcePaise(investedPaise, "investedPaise");

  return Number(((pnlPaise / investedPaise) * 100).toFixed(2));
};

module.exports = {
  enforcePaise,
  toPaise,
  calculatePct
};
