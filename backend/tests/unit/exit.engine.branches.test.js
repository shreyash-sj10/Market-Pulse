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
});
