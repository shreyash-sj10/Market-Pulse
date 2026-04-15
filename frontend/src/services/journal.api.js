import api from "./api.js";
import { normalizeResponse } from "../utils/contract.js";

export const getJournalSummary = async () => {
  const response = await api.get("/journal/summary");
  return normalizeResponse(response);
};
