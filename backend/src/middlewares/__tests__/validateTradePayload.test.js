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
    quantity: 2,
    pricePaise: 10000,
    stopLossPaise: 9500,
    targetPricePaise: 11000,
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

  it("fails when required canonical field is missing", () => {
    const { res, next } = runMiddleware({
      side: "BUY",
      quantity: 1,
      pricePaise: 10000,
      stopLossPaise: 9800,
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

  it("passes for valid canonical trade payload", () => {
    const { req, res, next } = runMiddleware(validBuyPayload, "/buy");

    expect(next).toHaveBeenCalledTimes(1);
    expect(req.body.type).toBe("BUY");
    expect(res.status).not.toHaveBeenCalled();
    expect(res.json).not.toHaveBeenCalled();
  });

  it("passes SELL payload without stopLossPaise and targetPricePaise", () => {
    const { req, res, next } = runMiddleware(
      {
        side: "SELL",
        quantity: 2,
        pricePaise: 9900,
      },
      "/sell"
    );

    expect(next).toHaveBeenCalledTimes(1);
    expect(req.body.type).toBe("SELL");
    expect(res.status).not.toHaveBeenCalled();
    expect(res.json).not.toHaveBeenCalled();
  });
});
