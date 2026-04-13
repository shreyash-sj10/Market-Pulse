const { z } = require("zod");

const createTradeSchema = z.object({
  body: z.object({
    type: z.enum(["BUY", "SELL"], { required_error: "Trade type is required" }),
    symbol: z
      .string({ required_error: "Ticker symbol is required" })
      .min(1, "Ticker symbol cannot be empty")
      .max(16, "Ticker symbol is too long (max 16 chars)")
      .toUpperCase(),
    quantity: z
      .number({ required_error: "Quantity is required" })
      .positive("Quantity must be a positive number greater than 0")
      .int("Quantity must be a whole number (no decimals)"),
    pricePaise: z
      .number({ required_error: "Execution value (Paise) is required" })
      .positive("Execution value must be greater than 0")
      .finite("Execution value must be a valid number"),
    stopLossPaise: z.number().positive().optional(),
    targetPricePaise: z.number().positive().optional(),
  }),
});


const validateData = (schema) => (req, res, next) => {
  try {
    // Parse forces validation of the schema against the req object
    schema.parse({
      body: req.body,
      query: req.query,
      params: req.params,
    });
    next();
  } catch (err) {
    if (err instanceof z.ZodError) {
      const validationErrors = err.issues.map((e) => ({
        field: e.path.join("."),
        message: e.message,
      }));
      
      const logger = require("../utils/logger");
      logger.warn(`[400] Validation failed - ${req.originalUrl}: ${JSON.stringify(validationErrors)}`);

      return res.status(400).json({
        success: false,
        message: "Invalid payload input",
        errors: validationErrors,
      });
    }
    next(err);
  }
};

module.exports = {
  createTradeSchema,
  validateData,
};
