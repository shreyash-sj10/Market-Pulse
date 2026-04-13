const { SYSTEM_STATE } = require("../../src/constants/systemState");
const {
  derivePortfolioPositionsState,
  deriveDecisionState,
  deriveReflectionState,
} = require("../../src/utils/systemState");

describe("SYSTEM_STATE model", () => {
  describe("Portfolio state", () => {
    it("no holdings -> EMPTY", () => {
      const state = derivePortfolioPositionsState({ holdingsCount: 0, positions: [] });
      expect(state).toBe(SYSTEM_STATE.EMPTY);
    });

    it("holdings + fallback price -> PARTIAL", () => {
      const state = derivePortfolioPositionsState({
        holdingsCount: 1,
        positions: [{ currentPricePaise: 250000, isFallback: true }],
      });
      expect(state).toBe(SYSTEM_STATE.PARTIAL);
    });

    it("holdings + valid live price -> ACTIVE", () => {
      const state = derivePortfolioPositionsState({
        holdingsCount: 1,
        positions: [{ currentPricePaise: 250000, isFallback: false }],
      });
      expect(state).toBe(SYSTEM_STATE.ACTIVE);
    });
  });

  describe("Decision state", () => {
    it("missing inputs -> PARTIAL", () => {
      const state = deriveDecisionState({ hasRequiredInputs: false, isValidated: false });
      expect(state).toBe(SYSTEM_STATE.PARTIAL);
    });

    it("full valid inputs -> COMPLETE", () => {
      const state = deriveDecisionState({ hasRequiredInputs: true, isValidated: true });
      expect(state).toBe(SYSTEM_STATE.COMPLETE);
    });
  });

  describe("Reflection state", () => {
    it("no closed trades -> EMPTY", () => {
      const state = deriveReflectionState({ closedTrades: [], reflections: [] });
      expect(state).toBe(SYSTEM_STATE.EMPTY);
    });

    it("closed trades + incomplete reflection -> PARTIAL", () => {
      const state = deriveReflectionState({
        closedTrades: [{ symbol: "RELIANCE.NS" }],
        reflections: [{ verdict: "POOR_PROCESS", insight: "Missing fields here." }],
      });
      expect(state).toBe(SYSTEM_STATE.PARTIAL);
    });

    it("closed trades + full reflection -> COMPLETE", () => {
      const state = deriveReflectionState({
        closedTrades: [{ symbol: "RELIANCE.NS" }],
        reflections: [{
          verdict: "DISCIPLINED_PROFIT",
          executionPattern: "TARGET_HIT",
          insight: "Exit matched plan.",
          improvement: "Maintain same rule quality.",
        }],
      });
      expect(state).toBe(SYSTEM_STATE.COMPLETE);
    });
  });
});

