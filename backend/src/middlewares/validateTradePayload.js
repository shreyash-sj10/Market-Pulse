const { z } = require("zod");
const { sendSuccess } = require("../utils/response.helper");
const { PRE_TRADE_EMOTION_VALUES } = require("../constants/preTradeEmotion.constants");

const preTradeEmotionSchema = z.enum(PRE_TRADE_EMOTION_VALUES, {
  required_error: "preTradeEmotion is required",
  invalid_type_error: "preTradeEmotion must be a string",
});

// ---------------------------------------------------------------------------
// Shared error responder
// ---------------------------------------------------------------------------
const fail = (req, res, code, message, details) =>
  sendSuccess(
    res,
    req,
    { success: false, error: { code, message, details } },
    400
  );

// ---------------------------------------------------------------------------
// Pre-trade schema — /api/intelligence/pre-trade (requests a token, has none yet)
// preTradeToken is intentionally absent here.
// ---------------------------------------------------------------------------
const preTradeBuySchema = z.object({
  symbol: z.string().trim().min(1, "symbol is required"),
  productType: z.enum(["DELIVERY", "INTRADAY"]).optional(),
  side: z.literal("BUY"),
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
    .int("quantity must be an integer")
    .positive("quantity must be greater than 0"),
  userThinking: z.string().trim().min(1).optional(),
  preTradeEmotion: preTradeEmotionSchema.optional(),
  decisionContext: z.record(z.string(), z.any()).optional(),
});

const preTradeSellSchema = z.object({
  symbol: z.string().trim().min(1, "symbol is required"),
  productType: z.enum(["DELIVERY", "INTRADAY"]).optional(),
  side: z.literal("SELL"),
  pricePaise: z
    .number({ required_error: "pricePaise is required" })
    .int("pricePaise must be an integer"),
  quantity: z
    .number({ required_error: "quantity is required" })
    .int("quantity must be an integer")
    .positive("quantity must be greater than 0"),
  userThinking: z.string().trim().min(1).optional(),
  preTradeEmotion: preTradeEmotionSchema.optional(),
  decisionContext: z.record(z.string(), z.any()).optional(),
});

const preTradeRequestSchema = z.discriminatedUnion("side", [
  preTradeBuySchema,
  preTradeSellSchema,
]);

const validatePreTradePayload = (req, res, next) => {
  const parsed = preTradeRequestSchema.safeParse(req.body || {});
  if (!parsed.success) {
    return fail(
      req,
      res,
      "INVALID_TRADE_PAYLOAD",
      "Pre-trade payload validation failed.",
      parsed.error.issues.map((issue) => ({
        field: issue.path.join("."),
        message: issue.message,
      }))
    );
  }
  req.body.type = parsed.data.side;
  return next();
};

// ---------------------------------------------------------------------------
// Execution schemas — /api/trades/buy and /api/trades/sell
// preTradeToken is REQUIRED: the token issued by /pre-trade must be presented.
// symbol is REQUIRED: a trade without a symbol is nonsensical.
// ---------------------------------------------------------------------------
const buyTradePayloadSchema = z
  .object({
    symbol: z.string().trim().min(1, "symbol is required"),
    productType: z.enum(["DELIVERY", "INTRADAY"]).optional(),
    side: z.literal("BUY"),
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
      .int("quantity must be an integer")
      .positive("quantity must be greater than 0"),
    userThinking: z.string().trim().min(1).optional(),
    preTradeEmotion: preTradeEmotionSchema,
    decisionContext: z.record(z.string(), z.any()).optional(),
    preTradeToken: z.string().trim().min(1, "preTradeToken is required"),
  })
  .strict();

const sellTradePayloadSchema = z
  .object({
    symbol: z.string().trim().min(1, "symbol is required"),
    productType: z.enum(["DELIVERY", "INTRADAY"]).optional(),
    side: z.literal("SELL"),
    pricePaise: z
      .number({ required_error: "pricePaise is required" })
      .int("pricePaise must be an integer"),
    quantity: z
      .number({ required_error: "quantity is required" })
      .int("quantity must be an integer")
      .positive("quantity must be greater than 0"),
    userThinking: z.string().trim().min(1).optional(),
    preTradeEmotion: preTradeEmotionSchema,
    decisionContext: z.record(z.string(), z.any()).optional(),
    preTradeToken: z.string().trim().min(1, "preTradeToken is required"),
  })
  .strict();

const tradePayloadSchema = z.discriminatedUnion("side", [
  buyTradePayloadSchema,
  sellTradePayloadSchema,
]);

const validateTradePayload = (req, res, next) => {
  // Clients may send the token via the `pre-trade-token` header (the original
  // contract) or in the JSON body. Normalise to the body before Zod validates
  // so both paths satisfy the required `preTradeToken` field.
  const body = req.body || {};
  const headerToken = req.headers?.["pre-trade-token"];
  if (headerToken && !body.preTradeToken) {
    body.preTradeToken = headerToken;
    req.body = body;
  }

  const parsed = tradePayloadSchema.safeParse(body);
  if (!parsed.success) {
    return fail(
      req,
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
  if (req.path === "/buy" && payload.side !== "BUY") {
    return fail(req, res, "INVALID_SIDE", "Route /buy requires side=BUY.", { side: payload.side });
  }
  if (req.path === "/sell" && payload.side !== "SELL") {
    return fail(req, res, "INVALID_SIDE", "Route /sell requires side=SELL.", { side: payload.side });
  }

  req.body.type = payload.side;
  return next();
};

module.exports = {
  validateTradePayload,
  validatePreTradePayload,
};
