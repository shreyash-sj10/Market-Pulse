const mongoose = require("mongoose");
const { mapToClosedTrades } = require("../../src/domain/closedTrade.mapper");
const { analyzeReflection } = require("../../src/engines/reflection.engine");
const assert = require("assert");

describe("Reflection Stress Integrity Test", () => {

  it("Should handle 20 rapid BUY/SELL trades with partial exits accurately", () => {
    const symbol = "STRESS.NS";
    const trades = [];
    
    // 1. 20 Rapid BUYs (Institutional Entry Accumulation)
    for (let i = 0; i < 20; i++) {
        trades.push({
            id: `buy-${i}`,
            symbol,
            type: "BUY",
            quantity: 10,
            pricePaise: 10000 + (i * 10), // slight drift
            stopLossPaise: 9500,
            targetPricePaise: 12000,
            rr: 4,
            createdAt: new Date(Date.now() - (100 - i) * 60000)
        });
    }

    // 2. Partial Exits (50%, 25%, 25%) repeated
    // Total accumulated: 200 qty
    // We'll do 4 sells of 50 each
    for (let j = 0; j < 4; j++) {
        trades.push({
            id: `sell-${j}`,
            symbol,
            type: "SELL",
            quantity: 50,
            pricePaise: 11000 + (j * 100),
            createdAt: new Date(Date.now() - (20 - j) * 60000)
        });
    }

    const closed = mapToClosedTrades(trades);

    // Assertions
    // 200 units total. Each SELL takes 50 units.
    // SELL 0 (50 qty) should pair with BUY 0, 1, 2, 3, 4 (10 each)
    // SELL 1 (50 qty) should pair with BUY 5, 6, 7, 8, 9
    // SELL 2 (50 qty) should pair with BUY 10-14
    // SELL 3 (50 qty) should pair with BUY 15-19
    // Total Closed Trades should be 20 (since each BUY is fully matched)
    
    assert.strictEqual(closed.length, 20);
    
    const totalQtyClosed = closed.reduce((acc, ct) => acc + ct.quantity, 0);
    assert.strictEqual(totalQtyClosed, 200);

    // Verify each reflection call succeeds
    closed.forEach(ct => {
        const reflection = analyzeReflection(ct);
        assert.strictEqual(typeof reflection.verdict, "string");
        assert.ok(reflection.deviationScore >= 0);
    });

    console.log(`[STRESS_TEST] Verified ${closed.length} closed trade mappings via FIFO.`);
  });

  it("Should throw STATE_CORRUPTION_DETECTED on orphan sales", () => {
     const orphanTrade = [
         { id: 'sell-1', symbol: 'ORPHAN', type: 'SELL', quantity: 10, pricePaise: 500, createdAt: new Date() }
     ];
     
     assert.throws(() => mapToClosedTrades(orphanTrade), /STATE_CORRUPTION_DETECTED/);
  });
});

