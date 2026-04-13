const { z } = require("zod");

const buyTradePayloadSchema = z.object({
  symbol: z.string().trim().min(1).optional(),
  pricePaise: z
    .number({ required_error: "pricePaise is required" })
    .int("pricePaise must be an integer"),
  stopLossPaise: z
    .number({ required_error: "stopLossPaise is required" })
    .int("stopLossPaise must be an integer"),
  targetPricePaise: z
    .number({ required_error: "targetPricePaise is required" })
    .int("targetPricePaise must be an integer"),
  quantity: z
    .number({ required_error: "quantity is required" })
    .positive("quantity must be greater than 0"),
  side: z.literal("BUY"),
  userThinking: z.string().trim().min(1).optional(),
  decisionContext: z.record(z.string(), z.any()).optional(),
  preTradeToken: z.string().trim().min(1).optional(),
}).strict();

const sellTradePayloadSchema = z.object({
  symbol: z.string().trim().min(1).optional(),
  pricePaise: z
    .number({ required_error: "pricePaise is required" })
    .int("pricePaise must be an integer"),
  quantity: z
    .number({ required_error: "quantity is required" })
    .positive("quantity must be greater than 0"),
  side: z.literal("SELL"),
  userThinking: z.string().trim().min(1).optional(),
  decisionContext: z.record(z.string(), z.any()).optional(),
  preTradeToken: z.string().trim().min(1).optional(),
}).strict();

const tradePayloadSchema = z.discriminatedUnion("side", [
  buyTradePayloadSchema,
  sellTradePayloadSchema,
]);

const fail = (res, code, message, details) =>
  res.status(400).json({
    success: false,
    error: {
      code,
      message,
      details,
    },
  });

const validateTradePayload = (req, res, next) => {
  const body = req.body || {};

  const parsed = tradePayloadSchema.safeParse(body);
  if (!parsed.success) {
    return fail(
      res,
      "INVALID_TRADE_PAYLOAD",
      "Trade payload validation failed.",
      parsed.error.issues.map((issue) => ({
        field: issue.path.join("."),
        message: issue.message,
      }))
    );
  }

  const payload = parsed.data;
  if (payload.side === "BUY") {
    if (payload.stopLossPaise >= payload.pricePaise) {
      return fail(
        res,
        "INVALID_STOPLOSS",
        "For BUY trades, stopLossPaise must be less than pricePaise.",
        { stopLossPaise: payload.stopLossPaise, pricePaise: payload.pricePaise }
      );
    }
    if (payload.targetPricePaise <= payload.pricePaise) {
      return fail(
        res,
        "INVALID_TARGET",
        "For BUY trades, targetPricePaise must be greater than pricePaise.",
        { targetPricePaise: payload.targetPricePaise, pricePaise: payload.pricePaise }
      );
    }
  }

  if (req.path === "/buy" && payload.side !== "BUY") {
    return fail(res, "INVALID_SIDE", "Route /buy requires side=BUY.", { side: payload.side });
  }

  if (req.path === "/sell" && payload.side !== "SELL") {
    return fail(res, "INVALID_SIDE", "Route /sell requires side=SELL.", { side: payload.side });
  }

  // Maintain compatibility with existing downstream flow that expects `type`.
  req.body.type = payload.side;
  return next();
};

module.exports = {
  validateTradePayload,
};
