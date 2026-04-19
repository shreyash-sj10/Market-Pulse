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

  it("classifies loss beyond stop loss as LATE_EXIT", () => {
    const result = evaluateExit({
      entryPlan: { entryPricePaise: 10000, stopLossPaise: 9000, targetPricePaise: 12000 },
      exitPricePaise: 8500,
    });

    expect(result.exitType).toBe("LATE_EXIT");
    expect(result.notes).toContain("HOLDING_LOSERS");
    expect(result.deviationScore).toBe(50);
  });

  it("classifies panic loss exits and scores deviation against full risk", () => {
    const result = evaluateExit({
      entryPlan: { entryPricePaise: 10000, stopLossPaise: 9000, targetPricePaise: 12000 },
      exitPricePaise: 9800,
      entryTime: 1700000000000,
      exitTime: 1700000300000,
    });

    expect(result.exitType).toBe("PANIC");
    expect(result.notes).toEqual(expect.arrayContaining(["PANIC_EXIT", "EARLY_CUT"]));
    expect(result.deviationScore).toBe(80);
  });

  it("classifies panic profit exits and marks early profit taking", () => {
    const result = evaluateExit({
      entryPlan: { entryPricePaise: 10000, stopLossPaise: 9000, targetPricePaise: 12000 },
      exitPricePaise: 10150,
      entryTime: 1700000000000,
      exitTime: 1700000200000,
    });

    expect(result.exitType).toBe("PANIC");
    expect(result.notes).toEqual(expect.arrayContaining(["PANIC_EXIT", "EARLY_PROFIT_TAKE"]));
  });

  it("uses neutral panic deviation when stop loss is not configured", () => {
    const result = evaluateExit({
      entryPlan: { entryPricePaise: 10000, targetPricePaise: 12000 },
      exitPricePaise: 9950,
      entryTime: 1700000000000,
      exitTime: 1700000200000,
    });

    expect(result.exitType).toBe("PANIC");
    expect(result.deviationScore).toBe(50);
  });

  it("uses fallback panic deviation when stop loss equals entry", () => {
    const result = evaluateExit({
      entryPlan: { entryPricePaise: 10000, stopLossPaise: 10000, targetPricePaise: 12000 },
      exitPricePaise: 10050,
      entryTime: 1700000000000,
      exitTime: 1700000200000,
    });

    expect(result.exitType).toBe("PANIC");
    expect(result.deviationScore).toBe(50);
  });
});
