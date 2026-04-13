const { analyzeBehavior } = require("../../src/services/behavior.engine");

const ms = (minutes) => minutes * 60 * 1000;

describe("behavior.engine determinism and detection", () => {
  it("detects revenge trading after a loss", () => {
    const t0 = Date.now();
    const closedTrades = [
      {
        symbol: "AAA.NS",
        entryTime: t0,
        exitTime: t0 + ms(30),
        pnlPaise: -500,
        holdTime: ms(30),
      },
      {
        symbol: "BBB.NS",
        entryTime: t0 + ms(45),
        exitTime: t0 + ms(90),
        pnlPaise: 200,
        holdTime: ms(45),
      },
    ];

    const result = analyzeBehavior(closedTrades);
    expect(result.success).toBe(true);
    expect(result.patterns.some((p) => p.type === "REVENGE_TRADING")).toBe(true);
  });

  it("detects overtrading when frequency is too high", () => {
    const start = Date.now();
    const closedTrades = Array.from({ length: 8 }, (_, i) => ({
      symbol: `SYM${i}.NS`,
      entryTime: start + i * ms(20),
      exitTime: start + i * ms(20) + ms(10),
      pnlPaise: i % 2 === 0 ? 100 : -100,
      holdTime: ms(10),
    }));

    const result = analyzeBehavior(closedTrades);
    expect(result.success).toBe(true);
    expect(result.patterns.some((p) => p.type === "OVERTRADING")).toBe(true);
  });

  it("produces same output for same input", () => {
    const start = Date.now();
    const closedTrades = [
      {
        symbol: "CONSISTENT.NS",
        entryTime: start,
        exitTime: start + ms(40),
        pnlPaise: 300,
        holdTime: ms(40),
      },
      {
        symbol: "CONSISTENT.NS",
        entryTime: start + ms(70),
        exitTime: start + ms(120),
        pnlPaise: -200,
        holdTime: ms(50),
      },
    ];

    const resultA = analyzeBehavior(closedTrades);
    const resultB = analyzeBehavior(closedTrades);
    expect(resultA).toEqual(resultB);
  });
});
