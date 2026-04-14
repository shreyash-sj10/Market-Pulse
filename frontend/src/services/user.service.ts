import { api } from "./api";
import type { ProfileData } from "../contracts/profile";

export const userService = {
  getProfile: async () => {
    const response = await api.get<{ success: boolean; data: ProfileData; state: string }>(
      "/user/profile"
    );
    return response.data;
  },
};
