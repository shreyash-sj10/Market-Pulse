const { analyzeReflection } = require("../../src/engines/reflection.engine");

describe("reflection.engine branch coverage", () => {
  it("throws on invalid input", () => {
    expect(() => analyzeReflection(null)).toThrow("INVALID_REFLECTION_INPUT");
  });

  it("returns DISCIPLINED_PROFIT on target hit", () => {
    const result = analyzeReflection({
      entryPricePaise: 10000,
      exitPricePaise: 12000,
      stopLossPaise: 9000,
      targetPricePaise: 12000,
    });
    expect(result.verdict).toBe("DISCIPLINED_PROFIT");
    expect(result.executionPattern).toBe("TARGET_HIT");
  });

  it("returns DISCIPLINED_LOSS on stop loss hit", () => {
    const result = analyzeReflection({
      entryPricePaise: 10000,
      exitPricePaise: 9000,
      stopLossPaise: 9000,
      targetPricePaise: 12000,
    });
    expect(result.verdict).toBe("DISCIPLINED_LOSS");
    expect(result.executionPattern).toBe("STOPPED_OUT");
  });

  it("returns POOR_PROCESS on early profit take", () => {
    const result = analyzeReflection({
      entryPricePaise: 10000,
      exitPricePaise: 10800,
      stopLossPaise: 9000,
      targetPricePaise: 12000,
    });
    expect(result.verdict).toBe("POOR_PROCESS");
    expect(result.tags).toContain("EARLY_EXIT");
  });

  it("returns DISCIPLINED_LOSS on early cut", () => {
    const result = analyzeReflection({
      entryPricePaise: 10000,
      exitPricePaise: 9300,
      stopLossPaise: 9000,
      targetPricePaise: 12000,
    });
    expect(result.verdict).toBe("DISCIPLINED_LOSS");
    expect(result.executionPattern).toBe("EARLY_CUT");
  });

  it("returns LUCKY_PROFIT on overhold", () => {
    const result = analyzeReflection({
      entryPricePaise: 10000,
      exitPricePaise: 13000,
      stopLossPaise: 9000,
      targetPricePaise: 12000,
    });
    expect(result.verdict).toBe("LUCKY_PROFIT");
    expect(result.tags).toContain("OVERHOLD");
  });

  it("maps deep loss under stop loss to DISCIPLINED_LOSS in current exit ordering", () => {
    const result = analyzeReflection({
      entryPricePaise: 10000,
      exitPricePaise: 8500,
      stopLossPaise: 9000,
      targetPricePaise: 12000,
    });
    expect(result.verdict).toBe("DISCIPLINED_LOSS");
    expect(result.executionPattern).toBe("STOPPED_OUT");
  });
});
