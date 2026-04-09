const { z } = require("zod");

const createTradeSchema = z.object({
  body: z.object({
    symbol: z
      .string({ required_error: "Ticker symbol is required" })
      .min(1, "Ticker symbol cannot be empty")
      .max(16, "Ticker symbol is too long (max 16 chars)")
      .toUpperCase(),
    quantity: z
      .number({ required_error: "Quantity is required" })
      .positive("Quantity must be a positive number greater than 0")
      .int("Quantity must be a whole number (no decimals)"),
    price: z
      .number({ required_error: "Execution price is required" })
      .positive("Execution price must be greater than 0")
      .finite("Execution price must be a valid number"),
    stopLoss: z.number().positive("Stop loss must be a positive price").nullable().optional(),
    targetPrice: z.number().positive("Target price must be a positive price").nullable().optional(),
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
