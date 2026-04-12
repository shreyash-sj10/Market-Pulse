const AppError = require("../../utils/AppError");
const { __testables } = require("../trade.service");

describe("trade.service plan enforcement", () => {
  describe("BUY plan validation", () => {
    it("rejects BUY when stopLoss/target are missing", () => {
      expect(() => __testables.validatePlanOrThrow("BUY", 10000, null, null))
        .toThrow("PLAN_REQUIRED");
    });

    it("rejects BUY when RR is below minimum", () => {
      expect(() => __testables.validatePlanOrThrow("BUY", 10000, 9900, 10100))
        .toThrow("INVALID_RR");
    });

    it("returns server-computed RR for a valid BUY plan", () => {
      const rr = __testables.validatePlanOrThrow("BUY", 10000, 9500, 11000);
      expect(rr).toBe(2);
    });
  });

  describe("SELL side guardrails", () => {
    it("enforces SELL target direction", () => {
      expect(() => __testables.validatePlanOrThrow("SELL", 10000, 10300, 10100))
        .toThrow("INVALID_TARGET");
    });

    it("enforces SELL stopLoss direction", () => {
      expect(() => __testables.validatePlanOrThrow("SELL", 10000, 9900, 9700))
        .toThrow("INVALID_STOPLOSS");
    });
  });

  it("uses AppError with 400 status for invalid plans", () => {
    try {
      __testables.validatePlanOrThrow("BUY", 10000, null, 11000);
    } catch (error) {
      expect(error).toBeInstanceOf(AppError);
      expect(error.statusCode).toBe(400);
      expect(error.message).toBe("PLAN_REQUIRED");
    }
  });
});
