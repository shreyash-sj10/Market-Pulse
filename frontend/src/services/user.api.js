import api from "./api.js";
import { normalizeResponse } from "../utils/contract.js";

export const getUserProfile = async () => {
  const response = await api.get("/users/profile");
  return normalizeResponse(response);
};
