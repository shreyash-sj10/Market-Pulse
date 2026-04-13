import api from "./api";

/**
 * INTELLIGENCE API
 * Interacts with the hybrid signal engine.
 */

export const getMarketIntelligence = async () => {
  try {
    const res = await api.get("/intelligence/news");
    return res.data;
  } catch (error) {
    return {
      state: "PARTIAL",
      data: { state: "PARTIAL", status: "UNAVAILABLE", reason: "NO_MARKET_SIGNALS", signals: [] },
    };
  }
};

export const getPortfolioIntelligence = async () => {
  try {
    const res = await api.get("/intelligence/portfolio");
    return res.data;
  } catch (error) {
    return {
      state: "PARTIAL",
      data: { state: "PARTIAL", status: "UNAVAILABLE", reason: "NO_MARKET_SIGNALS", signals: [] },
    };
  }
};

export const getGlobalIntelligence = async () => {
  try {
    const res = await api.get("/intelligence/global");
    return res.data;
  } catch (error) {
    return {
      state: "PARTIAL",
      data: { state: "PARTIAL", status: "UNAVAILABLE", reason: "NO_MARKET_SIGNALS", signals: [] },
    };
  }
};

export const getPreTradeGuard = async (tradeRequest) => {
  try {
    const res = await api.post("/intelligence/pre-trade", tradeRequest);
    return res.data.data;
  } catch (error) {
    console.error("[IntelAPI] Pre-trade interceptor failed:", error.message);
    throw error;
  }
};

export const getAdaptiveProfile = async () => {
  try {
    const res = await api.get("/intelligence/profile");
    return res.data.data;
  } catch (error) {
    console.error("[IntelAPI] Failed to fetch Adaptive Profile:", error.message);
    return null;
  }
};
export const getIntelligenceTimeline = () =>
  api.get("/intelligence/timeline").then(res => res.data).catch(() => ({ data: [] }));

export const submitTradeJudgment = (tradeData) =>
  api.post("/intelligence/judge-trade", tradeData).then(res => res.data);
