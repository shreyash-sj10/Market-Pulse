import api from "./api.js";

export const getPortfolioSummary = async () => {
    const response = await api.get("/portfolio/summary");
    return response.data;
};

export const getPositions = async () => {
    const response = await api.get("/portfolio/positions");
    return response.data;
};
