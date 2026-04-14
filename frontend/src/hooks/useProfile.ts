import { useQuery } from "@tanstack/react-query";
import { userService } from "../services/user.service";

export const useProfile = () => {
  return useQuery({
    queryKey: ["user", "profile"],
    queryFn: userService.getProfile,
  });
};
