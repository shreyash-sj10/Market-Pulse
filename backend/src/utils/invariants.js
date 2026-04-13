const Decimal = require("decimal.js");
const logger = require("./logger");
const AppError = require("./AppError");

/**
 * Enforces system-wide financial invariants to prevent state corruption.
 * This is the ultimate guardrail for the trading terminal.
 */
const validateSystemInvariants = (user, holdings = []) => {
  const errors = [];

  // 1. Balance Invariant: Must Never Be Negative
  if (user.balance < 0) {
    errors.push(`Balance violation: ${user.balance}`);
  }

  // 2. Holdings Invariant: No Zero or Negative Quantities
  //    Consistency Check: totalInvested must match sum(quantity * avgCost)
  let calculatedTotalInvested = new Decimal(0);
  
  holdings.forEach((holding) => {
    const symbol = holding.symbol;
    const quantity = Number(holding.quantity) || 0;
    const avgPricePaise = Number(holding.avgPricePaise) || 0;

    if (quantity <= 0) {
      errors.push(`Holdings violation: ${symbol} has invalid quantity ${quantity}`);
    }
    if (avgPricePaise < 0) {
      errors.push(`Holdings violation: ${symbol} has invalid avgPricePaise ${avgPricePaise}`);
    }

    const investment = new Decimal(quantity).mul(avgPricePaise);
    calculatedTotalInvested = calculatedTotalInvested.add(investment);
  });

  // 3. Total Invested Invariant: Matching check
  const storedTotalInvested = new Decimal(user.totalInvested || 0);
  if (!calculatedTotalInvested.equals(storedTotalInvested)) {
    errors.push(`TotalInvested mismatch: Stored ${storedTotalInvested.toNumber()}, Calculated ${calculatedTotalInvested.toNumber()}`);
  }

  // 4. State Corruption Response
  if (errors.length > 0) {
    logger.error("[Invariants] STATE_CORRUPTION_DETECTED", {
      userId: user._id,
      errors,
      snapshot: {
        balance: user.balance,
        totalInvested: user.totalInvested,
        holdingsCount: holdings.length
      }
    });

    throw new AppError("STATE_CORRUPTION_DETECTED: System invariants violated. Execution halted.", 500);
  }

  return true;
};

module.exports = { validateSystemInvariants };
