import api from "./api.js";
import { normalizeResponse } from "../contracts/contract.js";

export const getPortfolioSummary = async () => {
    const response = await api.get("/portfolio/summary");
    return normalizeResponse(response);
};

export const getPositions = async () => {
    const response = await api.get("/portfolio/positions");
    return normalizeResponse(response);
};
