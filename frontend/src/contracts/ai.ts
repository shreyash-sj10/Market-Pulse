export type AIResponse = {
  status: "OK" | "UNAVAILABLE";
  explanation: {
    summary: string;
    warnings: string[];
    keyFactors: string[];
  };
};
