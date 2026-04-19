/**
 * Runs before each test file. If jest-mongo-global-setup wrote a URI, force it so
 * later `dotenv.config()` does not override (dotenv does not replace existing env vars).
 */
const fs = require("fs");
const path = require("path");

const uriFile = path.join(__dirname, "..", ".mongo-jest-uri");

if (fs.existsSync(uriFile)) {
  const uri = fs.readFileSync(uriFile, "utf8").trim();
  if (uri) {
    process.env.MONGO_URI = uri;
    process.env.MONGODB_URI = uri;
  }
}

/** Deterministic integration tests (CI runs off exchange hours). */
process.env.ALLOW_CLOSED_MARKET_EXECUTION = "true";

/**
 * Guarantee JWT_SECRET is present so preTradeAuthority.store (and auth middleware)
 * do not throw at module-load time during test runs. CI injects the real value via
 * workflow env; this sentinel only fires when the env var is absent (local dev without .env).
 */
if (!process.env.JWT_SECRET) {
  process.env.JWT_SECRET = "jest_test_secret_do_not_use_in_production";
}
