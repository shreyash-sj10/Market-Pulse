import api from "./api.js";
import { normalizeResponse } from "../utils/contract.js";

export const loginUser = async ({ email, password }) => {
  const response = await api.post("/auth/login", { email, password });
  return normalizeResponse(response);
};

export const registerUser = async ({ name, email, password }) => {
  const response = await api.post("/auth/register", { name, email, password });
  return normalizeResponse(response);
};

export const getMe = async () => {
  const response = await api.get("/users/me");
  return normalizeResponse(response);
};
