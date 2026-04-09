const calculateMistakeAnalysis = require("../mistakeAnalysis.service");

describe("calculateMistakeAnalysis — Risk Engine", () => {
  // ─── Baseline helper ────────────────────────────────────────────────────────
  const base = (overrides = {}) => ({
    tradeValue: 500,
    balanceBeforeTrade: 10000,
    stopLoss: 145,
    targetPrice: 160,
    entryPrice: 150,
    tradesLast24h: 2,
    ...overrides,
  });

  // ─── RULE 1: OVER_RISK ───────────────────────────────────────────────────
  describe("RULE 1 — OVER_RISK", () => {
    it("does NOT flag OVER_RISK when trade is ≤5% of balance", () => {
      const result = calculateMistakeAnalysis(base({ tradeValue: 499, balanceBeforeTrade: 10000 }));
      expect(result.mistakeTags).not.toContain("OVER_RISK");
    });

    it("flags OVER_RISK and adds 10 points when trade is >5% of balance", () => {
      const result = calculateMistakeAnalysis(base({ tradeValue: 600, balanceBeforeTrade: 10000 }));
      expect(result.mistakeTags).toContain("OVER_RISK");
      expect(result.riskScore).toBeGreaterThanOrEqual(10);
    });

    it("flags OVER_RISK and adds 25 points when trade is >10% of balance", () => {
      const result = calculateMistakeAnalysis(base({ tradeValue: 1100, balanceBeforeTrade: 10000 }));
      expect(result.mistakeTags).toContain("OVER_RISK");
      expect(result.riskScore).toBeGreaterThanOrEqual(25);
    });

    it("flags OVER_RISK and adds 40 points when trade is >20% of balance", () => {
      const result = calculateMistakeAnalysis(base({ tradeValue: 2100, balanceBeforeTrade: 10000 }));
      expect(result.mistakeTags).toContain("OVER_RISK");
      expect(result.riskScore).toBeGreaterThanOrEqual(40);
    });
  });

  // ─── RULE 2: NO_STOP_LOSS ────────────────────────────────────────────────
  describe("RULE 2 — NO_STOP_LOSS", () => {
    it("flags NO_STOP_LOSS and adds 20 points when stopLoss is missing", () => {
      const result = calculateMistakeAnalysis(base({ stopLoss: undefined }));
      expect(result.mistakeTags).toContain("NO_STOP_LOSS");
      expect(result.riskScore).toBeGreaterThanOrEqual(20);
    });

    it("does NOT flag NO_STOP_LOSS when stopLoss is provided", () => {
      const result = calculateMistakeAnalysis(base({ stopLoss: 140 }));
      expect(result.mistakeTags).not.toContain("NO_STOP_LOSS");
    });

    it("flags NO_STOP_LOSS when stopLoss is null", () => {
      const result = calculateMistakeAnalysis(base({ stopLoss: null }));
      expect(result.mistakeTags).toContain("NO_STOP_LOSS");
    });
  });

  // ─── RULE 3: POOR_RR ─────────────────────────────────────────────────────
  describe("RULE 3 — POOR_RR (Risk/Reward Ratio)", () => {
    it("does NOT flag POOR_RR when R:R ≥ 2", () => {
      // risk = |150 - 140| = 10, reward = |170 - 150| = 20 → R:R = 2
      const result = calculateMistakeAnalysis(
        base({ entryPrice: 150, stopLoss: 140, targetPrice: 170 })
      );
      expect(result.mistakeTags).not.toContain("POOR_RR");
    });

    it("flags POOR_RR with +10 points when R:R is between 1 and 2", () => {
      // risk = |150 - 140| = 10, reward = |165 - 150| = 15 → R:R = 1.5
      const result = calculateMistakeAnalysis(
        base({ entryPrice: 150, stopLoss: 140, targetPrice: 165 })
      );
      expect(result.mistakeTags).toContain("POOR_RR");
      expect(result.riskScore).toBeGreaterThanOrEqual(10);
    });

    it("flags POOR_RR with +25 points when R:R is below 1", () => {
      // risk = |150 - 145| = 5, reward = |153 - 150| = 3 → R:R = 0.6
      const result = calculateMistakeAnalysis(
        base({ entryPrice: 150, stopLoss: 145, targetPrice: 153 })
      );
      expect(result.mistakeTags).toContain("POOR_RR");
      expect(result.riskScore).toBeGreaterThanOrEqual(25);
    });

    it("does NOT flag POOR_RR when any of entry/stop/target is missing", () => {
      const result = calculateMistakeAnalysis(base({ targetPrice: undefined }));
      expect(result.mistakeTags).not.toContain("POOR_RR");
    });
  });

  // ─── RULE 4: OVERTRADING ─────────────────────────────────────────────────
  describe("RULE 4 — OVERTRADING", () => {
    it("does NOT flag OVERTRADING when trades ≤5 in 24h", () => {
      const result = calculateMistakeAnalysis(base({ tradesLast24h: 5 }));
      expect(result.mistakeTags).not.toContain("OVERTRADING");
    });

    it("flags OVERTRADING with +10 when trades >5 in 24h", () => {
      const result = calculateMistakeAnalysis(base({ tradesLast24h: 6 }));
      expect(result.mistakeTags).toContain("OVERTRADING");
      expect(result.riskScore).toBeGreaterThanOrEqual(10);
    });

    it("flags OVERTRADING with +20 when trades >10 in 24h", () => {
      const result = calculateMistakeAnalysis(base({ tradesLast24h: 11 }));
      expect(result.mistakeTags).toContain("OVERTRADING");
      expect(result.riskScore).toBeGreaterThanOrEqual(20);
    });
  });

  // ─── RULE 5: SCORE CLAMPING ──────────────────────────────────────────────
  describe("RULE 5 — riskScore ceiling at 100", () => {
    it("never returns a score above 100 even when all rules fire", () => {
      const result = calculateMistakeAnalysis({
        tradeValue: 9500,       // >20% → +40
        balanceBeforeTrade: 10000,
        stopLoss: undefined,    // missing → +20
        targetPrice: 151,       // terrible R:R → +25
        entryPrice: 150,
        tradesLast24h: 15,      // >10 → +20
      });
      expect(result.riskScore).toBeLessThanOrEqual(100);
    });
  });

  // ─── RULE 6: MULTIPLE VIOLATIONS STACK ───────────────────────────────────
  describe("Multiple violations stack correctly", () => {
    it("returns multiple mistakeTags when multiple rules fire", () => {
      const result = calculateMistakeAnalysis(
        base({ stopLoss: undefined, tradesLast24h: 11, tradeValue: 2500, balanceBeforeTrade: 10000 })
      );
      expect(result.mistakeTags).toContain("NO_STOP_LOSS");
      expect(result.mistakeTags).toContain("OVERTRADING");
      expect(result.mistakeTags).toContain("OVER_RISK");
      expect(result.riskScore).toBeGreaterThan(50);
    });
  });

  // ─── RULE 7: CLEAN TRADE (HAPPY PATH) ────────────────────────────────────
  describe("Clean trade — no violations", () => {
    it("returns riskScore 0 and no tags for a perfect trade setup", () => {
      const result = calculateMistakeAnalysis({
        tradeValue: 200,        // 2% of balance — safe
        balanceBeforeTrade: 10000,
        stopLoss: 140,          // stop loss set
        targetPrice: 180,       // R:R = 3 — excellent
        entryPrice: 150,
        tradesLast24h: 3,       // low frequency
      });
      expect(result.riskScore).toBe(0);
      expect(result.mistakeTags).toHaveLength(0);
    });
  });
});
