const YahooFinance = require('yahoo-finance2').default;
const yahooFinance = new YahooFinance({ suppressNotices: ['yahooSurvey'] });
const marketDataService = require('./services/marketData.service');
const tradeService = require('./services/trade.service');
const mongoose = require('mongoose');
require('dotenv').config();

const audit = async () => {
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("      SYSTEM PRODUCTION AUDIT — PHASE 1 & 2      ");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  const symbol = "RELIANCE";

  // 1. TRACE: Market Data
  console.log(`[TRACE] Auditing Symbol: ${symbol}`);
  try {
    const apiSymbol = `${symbol}.NS`;
    const raw = await yahooFinance.quote(apiSymbol);
    console.log(`[PROVIDER] Raw Yahoo Response for ${apiSymbol}:`, {
        symbol: raw.symbol,
        pricePaise: Math.round((raw.regularMarketPrice || 0) * 100),
        currency: raw.currency,
        exchange: raw.fullExchangeName
    });

    const resolved = await marketDataService.resolvePrice(symbol);
    console.log(`[RESOLVED] Service Output:`, resolved);

    // Validation Check
    if (resolved.pricePaise <= 100) {
        console.error(`[CRITICAL] Quote inconsistency: Resolved pricePaise ${resolved.pricePaise} is too low!`);
    } else {
        console.log(`[OK] Quote validation passed.`);
    }
  } catch (err) {
    console.error(`[ERROR] Market Trace Failed:`, err.message);
  }

  // 2. TRACE: Chart Data
  console.log(`\n[TRACE] Auditing Chart Data: ${symbol}`);
  try {
    const historical = await marketDataService.getHistorical(symbol, "1mo");
    const prices = historical.data.prices;
    console.log(`[ANALYSIS] Candle Count: ${prices.length}`);
    
    // Check sorting
    let sorted = true;
    for(let i=1; i<prices.length; i++) {
        if (prices[i].timestamp < prices[i-1].timestamp) sorted = false;
    }
    console.log(`[ANALYSIS] Sorted by Timestamp: ${sorted ? 'YES' : 'NO'}`);

    // Check Nulls
    const hasNulls = prices.some(p => !p.open || !p.close || !p.high || !p.low);
    console.log(`[ANALYSIS] Contains Null/Missing OHLC: ${hasNulls ? 'YES' : 'NO'}`);

  } catch (err) {
    console.error(`[ERROR] Chart Audit Failed:`, err.message);
  }

  process.exit(0);
};

audit();
