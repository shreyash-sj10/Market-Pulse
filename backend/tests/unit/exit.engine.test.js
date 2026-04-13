const { evaluateExit } = require("../../src/engines/exit.engine");

describe("exit.engine", () => {
  const basePlan = {
    entryPricePaise: 10000,
    stopLossPaise: 9000,
    targetPricePaise: 12000,
  };

  it("classifies exit before stop loss as EARLY_EXIT", () => {
    const result = evaluateExit({
      entryPlan: basePlan,
      exitPricePaise: 9500,
    });

    expect(result.exitType).toBe("EARLY_EXIT");
    expect(result.notes).toContain("EARLY_CUT");
  });

  it("classifies exit at stop loss as STOP_LOSS_HIT", () => {
    const result = evaluateExit({
      entryPlan: basePlan,
      exitPricePaise: 9000,
    });

    expect(result.exitType).toBe("STOP_LOSS_HIT");
    expect(result.notes).toContain("STOPPED_OUT");
  });

  it("classifies exit at target as NORMAL", () => {
    const result = evaluateExit({
      entryPlan: basePlan,
      exitPricePaise: 12000,
    });

    expect(result.exitType).toBe("NORMAL");
    expect(result.notes).toContain("TARGET_HIT");
  });

  it("classifies exit beyond target as LATE_EXIT", () => {
    const result = evaluateExit({
      entryPlan: basePlan,
      exitPricePaise: 12500,
    });

    expect(result.exitType).toBe("LATE_EXIT");
    expect(result.notes).toContain("OVERHOLD");
  });
});

