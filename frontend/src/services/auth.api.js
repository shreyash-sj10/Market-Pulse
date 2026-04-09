import api from "./api.js";

export const loginUser = async ({ email, password }) => {
  const response = await api.post("/auth/login", { email, password });
  return response.data;
};

export const registerUser = async ({ email, password }) => {
  const response = await api.post("/auth/register", { email, password });
  return response.data;
};

export const getMe = async () => {
  const response = await api.get("/users/me");
  return response.data;
};
