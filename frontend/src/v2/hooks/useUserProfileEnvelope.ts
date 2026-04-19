import { useQuery } from "@tanstack/react-query";
import { getUserProfile } from "../api/user.api.js";
import { queryKeys } from "../queryKeys";
import { adaptUserProfileEnvelope, type UserProfileEnvelope } from "../pages/profile/adaptUserProfileEnvelope";

async function loadEnvelope(): Promise<UserProfileEnvelope> {
  try {
    const body = await getUserProfile();
    return adaptUserProfileEnvelope(body);
  } catch {
    return adaptUserProfileEnvelope(null);
  }
}

export function useUserProfileEnvelope(): {
  profile: UserProfileEnvelope | null;
  isLoading: boolean;
} {
  const q = useQuery({
    queryKey: queryKeys.userProfileEnvelope,
    queryFn: loadEnvelope,
    staleTime: 20_000,
    refetchOnWindowFocus: false,
    retry: 1,
  });

  if (q.isPending && !q.data) {
    return { profile: null, isLoading: true };
  }

  return { profile: q.data ?? null, isLoading: false };
}
