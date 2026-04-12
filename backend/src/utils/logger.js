/**
 * LOG PROXY LAYER
 * Redirects legacy log calls to the high-integrity Structured Logging system.
 */
const logger = require("../lib/logger");
module.exports = logger;
