const Decimal = require("decimal.js");
const logger = require("../utils/logger");

const tradeKey = (t) => (t && (t.tradeId || t.id)) || "";

/**
 * Computes reward-to-risk ratio from plan prices.
 * Returns null if sufficient data is unavailable.
 */
const computeRR = (entryPaise, stopPaise, targetPaise) => {
  if (!entryPaise || !stopPaise || !targetPaise) return null;
  const risk = Math.abs(entryPaise - stopPaise);
  const reward = Math.abs(targetPaise - entryPaise);
  if (risk === 0) return null;
  return Number((reward / risk).toFixed(2));
};

/**
 * Maps an array of normalized trades into paired ClosedTrade objects using FIFO logic.
 * Handles partial fills and ensures contract integrity.
 */
exports.mapToClosedTrades = (trades) => {
  if (!trades || !Array.isArray(trades)) return [];

  // Sort trades by creation date (Ascending) for FIFO pairing
  const sorted = [...trades].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
  
  const closedTrades = [];
  const holdingsPool = {}; // symbol -> BUY stack

  sorted.forEach((trade) => {
    const symbol = trade.symbol;
    const tradeType = trade.type;

    if (tradeType === "BUY") {
      if (!holdingsPool[symbol]) holdingsPool[symbol] = [];
      holdingsPool[symbol].push({ ...trade }); // Clone to track remaining quantity locally
      return;
    }

    if (tradeType === "SELL") {
      let sellQty = trade.quantity;
      const buyStack = holdingsPool[symbol] || [];

      if (buyStack.length === 0 && sellQty > 0) {
        logger.warn({
          action: "CLOSED_MAPPER_ORPHAN_SELL_SKIPPED",
          symbol,
          sellQty,
          hint: "SELL has no prior BUY in this slice — often partial history, pending guardian sell, or symbol mismatch.",
        });
        return;
      }

      while (sellQty > 0 && buyStack.length > 0) {
        const firstBuy = buyStack[0];
        const matchedQty = Math.min(sellQty, firstBuy.quantity);

        if (matchedQty <= 0) {
          logger.warn({ action: "CLOSED_MAPPER_ZERO_MATCH", symbol });
          break;
        }

        const entryVal = new Decimal(matchedQty).mul(firstBuy.pricePaise);
        const exitVal = new Decimal(matchedQty).mul(trade.pricePaise);
        const pnlPaise = exitVal.sub(entryVal).toNumber();
        
        const entryBasis = new Decimal(matchedQty).mul(firstBuy.pricePaise);
        const pnlPct = entryBasis.gt(0)
            ? Number(new Decimal(pnlPaise).div(entryBasis).mul(100).toFixed(2))
            : 0;

        const entryTime = new Date(firstBuy.openedAt || firstBuy.createdAt).getTime();
        const exitTime = new Date(trade.closedAt || trade.createdAt).getTime();

        const buyKey = tradeKey(firstBuy);
        const sellKey = tradeKey(trade);
        closedTrades.push({
          id: `ct-${buyKey}-${sellKey}`.substring(0, 64),
          symbol,
          productType: firstBuy.productType || "DELIVERY",
          terminalOpenPricePaise: firstBuy.terminalOpenPricePaise ?? null,
          entryPricePaise: firstBuy.pricePaise,
          exitPricePaise: trade.pricePaise,
          quantity: matchedQty,
          pnlPaise,
          pnlPct,
          holdTime: Math.max(0, exitTime - entryTime),
          rr: firstBuy.rr ?? computeRR(
            firstBuy.pricePaise,
            firstBuy.stopLossPaise,
            firstBuy.targetPricePaise
          ),
          stopLossPaise: firstBuy.stopLossPaise,
          targetPricePaise: firstBuy.targetPricePaise,
          entryTime,
          exitTime,
          entryTradeId: buyKey,
          exitTradeId: sellKey,
          decisionSnapshot: {
             entry: firstBuy.decision || firstBuy.decisionSnapshot || {},
             exit: trade.decision || trade.decisionSnapshot || {}
          },
          behaviorTags: [
            ...(firstBuy.behaviorTags || []),
            ...(trade.analysis?.mistakeTags || []),
            ...(trade.behaviorTags || [])
          ],
          entryPreTradeEmotion: firstBuy.preTradeEmotion || null,
        });

        sellQty -= matchedQty;
        firstBuy.quantity -= matchedQty;
        if (firstBuy.quantity <= 0) buyStack.shift();
      }

      if (sellQty > 0) {
        logger.warn({
          action: "CLOSED_MAPPER_UNFILLED_SELL",
          symbol,
          remainingQty: sellQty,
        });
      }
    }

    if (tradeType !== "BUY" && tradeType !== "SELL") {
      throw new Error(`INVALID_TRADE_TYPE_IN_CLOSED_MAPPER:${tradeType}`);
    }
  });

  return closedTrades;
};
