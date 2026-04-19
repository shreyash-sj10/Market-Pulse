const { isSquareoffWindowEligible } = require("../../src/utils/marketHours.util");

describe("isSquareoffWindowEligible (IST)", () => {
  const prev = process.env.SQUAREOFF_TIME_IST;

  afterEach(() => {
    if (prev === undefined) delete process.env.SQUAREOFF_TIME_IST;
    else process.env.SQUAREOFF_TIME_IST = prev;
  });

  it("returns false on Sunday even after 15:20 IST", () => {
    process.env.SQUAREOFF_TIME_IST = "15:20";
    const sundayAfterSquareoffIst = new Date("2026-04-19T10:30:00.000Z");
    expect(isSquareoffWindowEligible(sundayAfterSquareoffIst)).toBe(false);
  });

  it("returns false on Monday before configured squareoff time", () => {
    process.env.SQUAREOFF_TIME_IST = "15:20";
    const mondayBefore = new Date("2026-04-20T09:48:00.000Z");
    expect(isSquareoffWindowEligible(mondayBefore)).toBe(false);
  });

  it("returns true on Monday at/after configured squareoff time", () => {
    process.env.SQUAREOFF_TIME_IST = "15:20";
    const mondayAt = new Date("2026-04-20T09:50:00.000Z");
    expect(isSquareoffWindowEligible(mondayAt)).toBe(true);
  });
});
