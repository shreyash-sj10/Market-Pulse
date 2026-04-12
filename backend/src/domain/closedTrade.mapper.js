const Decimal = require("decimal.js");

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
    if (trade.side === "BUY") {
      if (!holdingsPool[symbol]) holdingsPool[symbol] = [];
      holdingsPool[symbol].push({ ...trade }); // Clone to track remaining quantity locally
      return;
    }

    if (trade.side === "SELL") {
      let sellQty = trade.quantity;
      const buyStack = holdingsPool[symbol] || [];

      if (buyStack.length === 0 && sellQty > 0) {
        throw new Error(`STATE_CORRUPTION_DETECTED: Orphan SELL detected for ${symbol}. No matching entry trades.`);
      }

      while (sellQty > 0 && buyStack.length > 0) {
        const firstBuy = buyStack[0];
        const matchedQty = Math.min(sellQty, firstBuy.quantity);

        if (matchedQty <= 0) {
          throw new Error(`STATE_CORRUPTION_DETECTED: Invalid matched quantity (0 or less) for ${symbol}.`);
        }

        const entryVal = new Decimal(matchedQty).mul(firstBuy.pricePaise);
        const exitVal = new Decimal(matchedQty).mul(trade.pricePaise);
        const pnl = exitVal.sub(entryVal).toNumber();
        
        const entryBasis = new Decimal(matchedQty).mul(firstBuy.pricePaise);
        const pnlPct = entryBasis.gt(0) 
            ? Number(new Decimal(pnl).div(entryBasis).toFixed(4)) 
            : 0;

        const entryTime = new Date(firstBuy.openedAt || firstBuy.createdAt).getTime();
        const exitTime = new Date(trade.closedAt || trade.createdAt).getTime();

        closedTrades.push({
          id: `ct-${firstBuy.id}-${trade.id}`.substring(0, 64),
          symbol,
          entryPricePaise: firstBuy.pricePaise,
          exitPricePaise: trade.pricePaise,
          quantity: matchedQty,
          pnl,
          pnlPct,
          holdTime: Math.max(0, exitTime - entryTime),
          rr: firstBuy.rrRatio || firstBuy.rr, 
          stopLossPaise: firstBuy.stopLossPaise || firstBuy.stopLoss,
          targetPricePaise: firstBuy.targetPricePaise || firstBuy.targetPrice,
          entryTime,
          exitTime,
          entryTradeId: firstBuy.id,
          exitTradeId: trade.id,
          decisionSnapshot: {
             entry: firstBuy.decision || firstBuy.decisionSnapshot || {},
             exit: trade.decision || trade.decisionSnapshot || {}
          },
          behaviorTags: [
            ...(firstBuy.behaviorTags || []),
            ...(trade.analysis?.mistakeTags || []),
            ...(trade.behaviorTags || [])
          ]
        });

        sellQty -= matchedQty;
        firstBuy.quantity -= matchedQty;
        if (firstBuy.quantity <= 0) buyStack.shift();
      }

      if (sellQty > 0) {
        throw new Error(`STATE_CORRUPTION_DETECTED: Unfilled SELL quantity (${sellQty}) for ${symbol} with empty buy stack.`);
      }
    }
  });

  return closedTrades;
};

