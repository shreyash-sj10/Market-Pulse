import api from "./api.js";
import { normalizeResponse } from "../utils/contract.js";

/**
 * INTELLIGENCE API
 * Interacts with the hybrid signal engine.
 */

export const getMarketIntelligence = async () => {
  try {
    const response = await api.get("/intelligence/news");
    return normalizeResponse(response);
  } catch (error) {
    return {
      success: false,
      state: "PARTIAL",
      data: { state: "PARTIAL", status: "UNAVAILABLE", reason: "NO_MARKET_SIGNALS", signals: [] },
    };
  }
};

export const getPortfolioIntelligence = async () => {
  try {
    const response = await api.get("/intelligence/portfolio");
    return normalizeResponse(response);
  } catch (error) {
    return {
      success: false,
      state: "PARTIAL",
      data: { state: "PARTIAL", status: "UNAVAILABLE", reason: "NO_MARKET_SIGNALS", signals: [] },
    };
  }
};

export const getGlobalIntelligence = async () => {
  try {
    const response = await api.get("/intelligence/global");
    return normalizeResponse(response);
  } catch (error) {
    return {
      success: false,
      state: "PARTIAL",
      data: { state: "PARTIAL", status: "UNAVAILABLE", reason: "NO_MARKET_SIGNALS", signals: [] },
    };
  }
};

export const getPreTradeGuard = async (tradeRequest) => {
  const response = await api.post("/intelligence/pre-trade", tradeRequest);
  return normalizeResponse(response);
};

export const getAdaptiveProfile = async () => {
  const response = await api.get("/intelligence/profile");
  return normalizeResponse(response);
};

export const getIntelligenceTimeline = async () => {
  const response = await api.get("/intelligence/timeline");
  return normalizeResponse(response);
};

export const submitTradeJudgment = async (tradeData) => {
  const response = await api.post("/intelligence/judge-trade", tradeData);
  return normalizeResponse(response);
};
