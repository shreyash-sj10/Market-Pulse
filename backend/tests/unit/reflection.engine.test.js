jest.mock("../../src/engines/exit.engine", () => ({
  evaluateExit: jest.fn(),
}));

const { evaluateExit } = require("../../src/engines/exit.engine");
const { analyzeReflection } = require("../../src/engines/reflection.engine");

describe("reflection.engine", () => {
  it("uses exit.engine output to build reflection result", () => {
    evaluateExit.mockReturnValue({
      exitType: "EARLY_EXIT",
      deviationScore: 55,
      notes: ["EARLY_PROFIT_TAKE"],
    });

    const reflection = analyzeReflection({
      entryPricePaise: 10000,
      exitPricePaise: 11100,
      stopLossPaise: 9000,
      targetPricePaise: 12000,
    });

    expect(evaluateExit).toHaveBeenCalledWith({
      entryPlan: {
        entryPricePaise: 10000,
        stopLossPaise: 9000,
        targetPricePaise: 12000,
      },
      exitPricePaise: 11100,
      currentPricePaise: undefined,
      timeHeld: undefined,
      behaviorContext: { tags: [] },
    });

    expect(reflection.deviationScore).toBe(55);
    expect(reflection.executionPattern).toBe("EARLY_EXIT");
    expect(reflection.verdict).toBe("POOR_PROCESS");
    expect(reflection.tags).toContain("EARLY_EXIT");
  });
});

