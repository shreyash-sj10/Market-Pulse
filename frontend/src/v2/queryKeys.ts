export const queryKeys = {
  portfolio: ["portfolio"] as const,
  portfolioSummary: ["portfolio-summary"] as const,
  journal: ["journal"] as const,
  profile: ["profile"] as const,
  trace: ["trace"] as const,
  /** Home attention rail: portfolio + market snapshot */
  attention: ["attention"] as const,
  markets: ["markets"] as const,
  marketTechnicals: (symbol: string) => ["market", "technicals", symbol] as const,
  aiInsights: ["ai-insights"] as const,
};
