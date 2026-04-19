const { buildSystemRequestId, getISTDateKey } = require("../../src/utils/systemRequestId");

describe("buildSystemRequestId", () => {
  it("formats type:userId:SYMBOL:date and uppercases symbol", () => {
    const id = buildSystemRequestId({
      type: "SL",
      userId: "507f1f77bcf86cd799439011",
      symbol: "reliance.ns",
    });
    expect(id).toMatch(
      /^SL:507f1f77bcf86cd799439011:RELIANCE\.NS:\d{4}-\d{2}-\d{2}$/
    );
  });

  it("separates SL, TARGET, and SQ namespaces for same user+symbol", () => {
    const uid = "user1";
    const sym = "TCS.NS";
    const sl = buildSystemRequestId({ type: "SL", userId: uid, symbol: sym });
    const tg = buildSystemRequestId({ type: "TARGET", userId: uid, symbol: sym });
    const sq = buildSystemRequestId({ type: "SQ", userId: uid, symbol: sym });
    expect(new Set([sl, tg, sq]).size).toBe(3);
  });

  it("matches getISTDateKey suffix", () => {
    const day = getISTDateKey();
    const id = buildSystemRequestId({ type: "SQ", userId: "u", symbol: "INFY.NS" });
    expect(id.endsWith(`:${day}`)).toBe(true);
  });

  it("getISTDateKey returns YYYY-MM-DD", () => {
    expect(getISTDateKey()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
