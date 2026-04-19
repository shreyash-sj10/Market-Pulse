#!/usr/bin/env node
/**
 * Deploy gate: required env vars present (no secret values printed).
 * Usage: node scripts/verify-env.js
 * Exit 0 = OK, 1 = missing required.
 */
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

const required = ["MONGO_URI", "JWT_SECRET"];

const missing = required.filter((k) => !process.env[k] || String(process.env[k]).trim() === "");

if (missing.length) {
  console.error(`[verify-env] Missing required: ${missing.join(", ")}`);
  process.exit(1);
}

if (process.env.NODE_ENV === "production") {
  if (!process.env.FRONTEND_URL || String(process.env.FRONTEND_URL).includes("localhost")) {
    console.warn(
      "[verify-env] WARN: FRONTEND_URL should be your real HTTPS origin in production (CORS / cookies)."
    );
  }
}

console.log("[verify-env] Required variables present.");
process.exit(0);
