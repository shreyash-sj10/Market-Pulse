const { validateTradePayload } = require("../validateTradePayload");

const runMiddleware = (body, path = "/buy") => {
  const req = { body: { ...body }, path };
  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn(),
  };
  const next = jest.fn();

  validateTradePayload(req, res, next);
  return { req, res, next };
};

describe("validateTradePayload strict canonical enforcement", () => {
  const validBuyPayload = {
    side: "BUY",
    symbol: "RELIANCE.NS",
    quantity: 2,
    pricePaise: 10000,
    stopLossPaise: 9500,
    targetPricePaise: 11000,
    preTradeEmotion: "CALM",
    preTradeToken: "test-pre-trade-token-uuid",
  };

  const validSellPayload = {
    side: "SELL",
    symbol: "RELIANCE.NS",
    quantity: 2,
    pricePaise: 9900,
    preTradeEmotion: "DISCIPLINED",
    preTradeToken: "test-pre-trade-token-uuid",
  };

  it("fails when unknown field is present", () => {
    const { res, next } = runMiddleware({
      ...validBuyPayload,
      legacyField: 1,
    });

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: expect.objectContaining({
          code: "INVALID_TRADE_PAYLOAD",
          details: expect.arrayContaining([
            expect.objectContaining({ field: "", message: expect.stringContaining("Unrecognized key") }),
          ]),
        }),
      })
    );
  });

  it("fails when required canonical field is missing (targetPricePaise)", () => {
    const { res, next } = runMiddleware({
      side: "BUY",
      symbol: "RELIANCE.NS",
      quantity: 1,
      pricePaise: 10000,
      stopLossPaise: 9800,
      preTradeToken: "test-pre-trade-token-uuid",
    });

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: expect.objectContaining({
          code: "INVALID_TRADE_PAYLOAD",
          details: expect.arrayContaining([
            expect.objectContaining({ field: "targetPricePaise" }),
          ]),
        }),
      })
    );
  });

  it("fails when symbol is missing on BUY", () => {
    const { symbol: _omit, ...payloadWithoutSymbol } = validBuyPayload;
    const { res, next } = runMiddleware(payloadWithoutSymbol);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: expect.objectContaining({
          code: "INVALID_TRADE_PAYLOAD",
          details: expect.arrayContaining([
            expect.objectContaining({ field: "symbol" }),
          ]),
        }),
      })
    );
  });

  it("fails when preTradeToken is missing on BUY", () => {
    const { preTradeToken: _omit, ...payloadWithoutToken } = validBuyPayload;
    const { res, next } = runMiddleware(payloadWithoutToken);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: expect.objectContaining({
          code: "INVALID_TRADE_PAYLOAD",
          details: expect.arrayContaining([
            expect.objectContaining({ field: "preTradeToken" }),
          ]),
        }),
      })
    );
  });

  it("fails when preTradeToken is missing on SELL", () => {
    const { preTradeToken: _omit, ...payloadWithoutToken } = validSellPayload;
    const { res, next } = runMiddleware(payloadWithoutToken, "/sell");

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: expect.objectContaining({
          code: "INVALID_TRADE_PAYLOAD",
          details: expect.arrayContaining([
            expect.objectContaining({ field: "preTradeToken" }),
          ]),
        }),
      })
    );
  });

  it("fails for mixed schema payload (canonical + legacy)", () => {
    const { res, next } = runMiddleware({
      ...validBuyPayload,
      rogueInput: 100,
    });

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: expect.objectContaining({
          code: "INVALID_TRADE_PAYLOAD",
        }),
      })
    );
  });

  it("passes for valid canonical BUY payload", () => {
    const { req, res, next } = runMiddleware(validBuyPayload, "/buy");

    expect(next).toHaveBeenCalledTimes(1);
    expect(req.body.type).toBe("BUY");
    expect(res.status).not.toHaveBeenCalled();
    expect(res.json).not.toHaveBeenCalled();
  });

  it("passes SELL payload without stopLossPaise and targetPricePaise", () => {
    const { req, res, next } = runMiddleware(validSellPayload, "/sell");

    expect(next).toHaveBeenCalledTimes(1);
    expect(req.body.type).toBe("SELL");
    expect(res.status).not.toHaveBeenCalled();
    expect(res.json).not.toHaveBeenCalled();
  });

  it("fails BUY when preTradeEmotion is invalid", () => {
    const { res, next } = runMiddleware({
      ...validBuyPayload,
      preTradeEmotion: "PANIC",
    });

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: expect.objectContaining({
          code: "INVALID_TRADE_PAYLOAD",
          details: expect.arrayContaining([expect.objectContaining({ field: "preTradeEmotion" })]),
        }),
      }),
    );
  });
});
