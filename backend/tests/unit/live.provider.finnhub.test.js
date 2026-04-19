process.env.NODE_ENV = "test";
process.env.FINNHUB_API_KEY = "test-finnhub-key";

const mockQuote = jest.fn();

jest.mock("yahoo-finance2", () => ({
  default: class {
    constructor() {
      this.quote = mockQuote;
    }
  },
}));

const axios = require("axios");
jest.mock("axios", () => ({
  get: jest.fn(),
}));

const { resolvePrice } = require("../../src/services/marketData/live.provider");

describe("live.provider Finnhub fallback", () => {
  beforeEach(() => {
    mockQuote.mockRejectedValue(new Error("YAHOO_DOWN"));
    require("axios").get.mockResolvedValue({
      data: { c: 2850.75, d: 12.3, dp: 0.43 },
    });
  });

  it("requests NSE:SYMBOL and maps close price to INR paise", async () => {
    const q = await resolvePrice("UNIQUEFINNHUBXYZ");
    expect(require("axios").get).toHaveBeenCalled();
    const url = require("axios").get.mock.calls[0][0];
    expect(url).toContain(encodeURIComponent("NSE:UNIQUEFINNHUBXYZ"));
    expect(q.pricePaise).toBe(Math.round(2850.75 * 100));
    expect(q.isFallback).toBe(true);
  });
});
