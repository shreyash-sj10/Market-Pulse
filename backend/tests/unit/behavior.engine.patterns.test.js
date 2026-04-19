const { analyzeBehavior } = require("../../src/services/behavior.engine");

/** Minimal closed-trade row for behavior engine (timestamps = epoch ms). */
const ct = (overrides) => ({
  symbol: "TST",
  entryTime: Date.now(),
  exitTime: Date.now() + 3600000,
  entryPricePaise: 10000,
  exitPricePaise: 10500,
  pnlPaise: 500,
  pnlPct: 5,
  ...overrides,
});

describe("behavior.engine extended patterns", () => {
  const baseHistory = (extra) => {
    const t0 = Date.UTC(2025, 0, 1, 10, 0, 0);
    return [
      ct({ entryTime: t0, exitTime: t0 + 1000, pnlPaise: 100 }),
      ct({ entryTime: t0 + 2000, exitTime: t0 + 3000, pnlPaise: 50 }),
      ct({ entryTime: t0 + 4000, exitTime: t0 + 5000, pnlPaise: -20, ...extra }),
    ];
  };

  it("flags FOMO_ENTRY for intraday entry in last window before cash close (IST)", () => {
    const entry = Date.UTC(2026, 3, 20, 9, 35, 0);
    const exit = entry + 60000;
    const hist = [
      ...baseHistory({}),
      ct({
        productType: "INTRADAY",
        entryTime: entry,
        exitTime: exit,
        pnlPaise: 10,
        entryPricePaise: 10000,
        exitPricePaise: 10100,
      }),
    ];
    const r = analyzeBehavior(hist);
    expect(r.patterns.some((p) => p.type === "FOMO_ENTRY")).toBe(true);
  });

  it("does not flag FOMO_ENTRY at 14:00 IST intraday", () => {
    const entry = Date.UTC(2026, 3, 20, 8, 30, 0);
    const exit = entry + 60000;
    const hist = [
      ...baseHistory({}),
      ct({
        productType: "INTRADAY",
        entryTime: entry,
        exitTime: exit,
        pnlPaise: 10,
      }),
    ];
    const r = analyzeBehavior(hist);
    expect(r.patterns.some((p) => p.type === "FOMO_ENTRY")).toBe(false);
  });

  it("flags CHASING_PRICE when entry is ≥2% above terminal open", () => {
    const hist = [
      ...baseHistory({}),
      ct({
        terminalOpenPricePaise: 10000,
        entryPricePaise: 10200,
        exitPricePaise: 10100,
        pnlPaise: -100,
      }),
    ];
    const r = analyzeBehavior(hist);
    expect(r.patterns.some((p) => p.type === "CHASING_PRICE")).toBe(true);
  });

  it("does not flag CHASING_PRICE at 0.4% above open", () => {
    const hist = [
      ...baseHistory({}),
      ct({
        terminalOpenPricePaise: 100000,
        entryPricePaise: 100400,
        exitPricePaise: 100200,
        pnlPaise: -200,
      }),
    ];
    const r = analyzeBehavior(hist);
    expect(r.patterns.some((p) => p.type === "CHASING_PRICE")).toBe(false);
  });

  it("exponential revenge: wider gap still counts with longer post-loss streak", () => {
    const sym = "REV";
    const t0 = Date.UTC(2025, 5, 2, 12, 0, 0);
    const hist = [
      ct({ symbol: sym, entryTime: t0, exitTime: t0 + 1, pnlPaise: -100, entryPricePaise: 100, exitPricePaise: 90 }),
      ct({ symbol: sym, entryTime: t0 + 2, exitTime: t0 + 3, pnlPaise: -50, entryPricePaise: 100, exitPricePaise: 95 }),
      ct({
        symbol: sym,
        entryTime: t0 + 3 * 60 * 1000,
        exitTime: t0 + 3 * 60 * 1000 + 1,
        pnlPaise: -40,
        entryPricePaise: 100,
        exitPricePaise: 96,
      }),
      ct({
        symbol: sym,
        entryTime: t0 + 3 * 60 * 1000 + 90 * 60 * 1000,
        exitTime: t0 + 3 * 60 * 1000 + 90 * 60 * 1000 + 1,
        pnlPaise: 10,
        entryPricePaise: 100,
        exitPricePaise: 101,
      }),
    ];
    const r = analyzeBehavior(hist);
    expect(r.patterns.some((p) => p.type === "REVENGE_TRADING")).toBe(true);
  });

  it("flags OVERTRADING_DAILY when one IST day exceeds daily cap", () => {
    const day = Date.UTC(2025, 8, 10, 12, 0, 0);
    const hist = [];
    for (let i = 0; i < 8; i += 1) {
      hist.push(
        ct({
          entryTime: day + i * 1000,
          exitTime: day + i * 1000 + 500,
          pnlPaise: 1,
        })
      );
    }
    const r = analyzeBehavior(hist);
    expect(r.patterns.some((p) => p.type === "OVERTRADING_DAILY")).toBe(true);
  });
});
