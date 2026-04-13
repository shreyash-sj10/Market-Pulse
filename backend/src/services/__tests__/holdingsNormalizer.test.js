const {
  toHoldingsObject,
  toHoldingsArray,
  toHoldingsLookup,
} = require("../../utils/holdingsNormalizer");

describe("holdings normalizer", () => {
  it("converts holdings Map to plain object", () => {
    const holdingsMap = new Map([
      ["TCS_NS", { quantity: 2, avgCost: 350000 }],
    ]);

    const obj = toHoldingsObject(holdingsMap);
    expect(obj).toEqual({
      TCS_NS: { quantity: 2, avgCost: 350000 },
    });
  });

  it("formats holdings as [{ symbol, quantity, avgPrice }]", () => {
    const holdingsMap = new Map([
      ["INFY_NS", { quantity: 3, avgCost: 152080 }],
    ]);

    const arr = toHoldingsArray(holdingsMap);
    expect(arr).toEqual([
      { symbol: "INFY.NS", quantity: 3, avgPrice: 152080, stopLossPaise: null, targetPricePaise: null },
    ]);
  });

  it("builds lookup for both full and base symbols", () => {
    const lookup = toHoldingsLookup({
      RELIANCE_NS: { quantity: 1, avgCost: 290000 },
    });

    expect(lookup["RELIANCE.NS"]).toBeDefined();
    expect(lookup.RELIANCE).toBeDefined();
  });
});
