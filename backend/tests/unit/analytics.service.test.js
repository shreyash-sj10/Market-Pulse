jest.mock("../../src/models/trade.model", () => ({
  find: jest.fn(),
}));

jest.mock("../../src/models/user.model", () => ({
  exists: jest.fn(),
  updateOne: jest.fn(),
}));

jest.mock("../../src/domain/trade.contract", () => ({
  normalizeTrade: jest.fn((t) => t),
}));

jest.mock("../../src/domain/closedTrade.mapper", () => ({
  mapToClosedTrades: jest.fn((rows) => rows),
}));

jest.mock("../../src/engines/reflection.engine", () => ({
  analyzeReflection: jest.fn(() => ({ verdict: "OK" })),
}));

jest.mock("../../src/services/behavior.engine", () => ({
  analyzeBehavior: jest.fn(() => ({
    patterns: [{ type: "PAT1" }],
    disciplineScore: 80,
    winRate: 50,
    avgPnlPct: 1,
  })),
}));

jest.mock("../../src/services/progression.engine", () => ({
  analyzeProgression: jest.fn(() => ({ trend: "STABLE", success: true })),
}));

jest.mock("../../src/services/skill.engine", () => ({
  calculateSkillScore: jest.fn(() => ({
    score: 72,
    strengths: ["S1"],
    weaknesses: ["W1"],
    breakdown: { discipline: 80 },
  })),
}));

jest.mock("../../src/services/patternInsight.service", () => ({
  generatePatternInsight: jest.fn(() => ({ summary: "ok" })),
}));

const Trade = require("../../src/models/trade.model");
const User = require("../../src/models/user.model");
const { computeUserAnalytics, persistUserAnalyticsSnapshot } = require("../../src/services/analytics.service");

describe("analytics.service", () => {
  beforeEach(() => {
    Trade.find.mockReturnValue({
      sort: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      lean: jest.fn().mockResolvedValue([{ _id: "1", user: "u1" }]),
    });
    User.exists.mockResolvedValue(true);
    User.updateOne.mockResolvedValue({ acknowledged: true });
  });

  it("computeUserAnalytics returns snapshot without touching User", async () => {
    const { snapshot } = await computeUserAnalytics("u1");
    expect(snapshot.skillScore).toBe(72);
    expect(snapshot.tags.length).toBeGreaterThan(0);
    expect(User.updateOne).not.toHaveBeenCalled();
  });

  it("persistUserAnalyticsSnapshot skips when user missing", async () => {
    User.exists.mockResolvedValue(false);
    await persistUserAnalyticsSnapshot("missing");
    expect(User.updateOne).not.toHaveBeenCalled();
  });

  it("persistUserAnalyticsSnapshot writes analyticsSnapshot and analyticsLastUpdatedAt", async () => {
    await persistUserAnalyticsSnapshot("u1");
    expect(User.updateOne).toHaveBeenCalledWith(
      { _id: "u1" },
      expect.objectContaining({
        $set: expect.objectContaining({
          analyticsSnapshot: expect.objectContaining({ skillScore: 72 }),
          analyticsLastUpdatedAt: expect.any(Date),
        }),
      })
    );
  });
});
