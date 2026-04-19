/**
 * L-02 / M-06: Single Gemini SDK client + configurable model name.
 * Avoids constructing GoogleGenerativeAI on every request.
 */
const { GoogleGenerativeAI } = require("@google/generative-ai");

const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-1.5-flash";

let sharedClient = null;

/** @param {Record<string, unknown>} [generationConfig] Gemini generationConfig */
function getGenerativeModel(generationConfig) {
  if (!process.env.GEMINI_API_KEY) return null;
  if (!sharedClient) {
    sharedClient = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  }
  return sharedClient.getGenerativeModel({
    model: GEMINI_MODEL,
    ...(generationConfig ? { generationConfig } : {}),
  });
}

module.exports = { getGenerativeModel, GEMINI_MODEL };
