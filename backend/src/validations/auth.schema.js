const { z } = require("zod");

const authSchema = z.object({
  body: z.object({
    name: z
      .string()
      .min(2, "Name must be at least 2 characters")
      .max(50, "Name is too long")
      .optional(),
    email: z
      .string({ required_error: "Email address is required" })
      .email("Please provide a valid email address (e.g. trader@example.com)"),
    password: z
      .string({ required_error: "Password is required" })
      .min(6, "Password is too weak. It must be at least 6 characters long"),
  }),
});

module.exports = {
  authSchema
};
