const { evaluateExit } = require("../../src/engines/exit.engine");

describe("exit.engine branch coverage", () => {
  it("throws on non-object input", () => {
    expect(() => evaluateExit(null)).toThrow("INVALID_EXIT_INPUT");
  });

  it("throws when entry or exit price is missing", () => {
    expect(() =>
      evaluateExit({
        entryPlan: { stopLossPaise: 9000, targetPricePaise: 11000 },
      })
    ).toThrow("INVALID_EXIT_INPUT: entry/exit prices are required");
  });

  it("treats exit below stop loss as STOP_LOSS_HIT", () => {
    const result = evaluateExit({
      entryPlan: { entryPricePaise: 10000, stopLossPaise: 9000, targetPricePaise: 12000 },
      exitPricePaise: 8500,
    });

    expect(result.exitType).toBe("STOP_LOSS_HIT");
    expect(result.notes).toContain("STOPPED_OUT");
  });

  it("classifies PANIC when exit is soon after entry and price is above stop", () => {
    const entryTime = 1_700_000_000_000;
    const exitTime = entryTime + 2 * 60 * 1000;
    const result = evaluateExit({
      entryPlan: { entryPricePaise: 10000, stopLossPaise: 9000, targetPricePaise: 12000 },
      exitPricePaise: 9800,
      entryTime,
      exitTime,
    });
    expect(result.exitType).toBe("PANIC");
    expect(result.isPanic).toBe(true);
    expect(result.notes).toContain("PANIC_EXIT");
    expect(result.deviationScore).toBeGreaterThanOrEqual(0);
    expect(result.deviationScore).toBeLessThanOrEqual(100);
  });

  it("PANIC without stop uses neutral deviation score", () => {
    const entryTime = 1_700_000_000_000;
    const exitTime = entryTime + 3 * 60 * 1000;
    const result = evaluateExit({
      entryPlan: { entryPricePaise: 10000, stopLossPaise: 0, targetPricePaise: 12000 },
      exitPricePaise: 10100,
      entryTime,
      exitTime,
    });
    expect(result.exitType).toBe("PANIC");
    expect(result.deviationScore).toBe(50);
    expect(result.notes).toContain("PANIC_EXIT");
    expect(result.notes).toContain("EARLY_PROFIT_TAKE");
  });

  it("PANIC on loss path records EARLY_CUT", () => {
    const entryTime = 1_700_000_000_000;
    const exitTime = entryTime + 4 * 60 * 1000;
    const result = evaluateExit({
      entryPlan: { entryPricePaise: 10000, stopLossPaise: 9000, targetPricePaise: 12000 },
      exitPricePaise: 9700,
      entryTime,
      exitTime,
    });
    expect(result.exitType).toBe("PANIC");
    expect(result.notes).toContain("EARLY_CUT");
  });

});
