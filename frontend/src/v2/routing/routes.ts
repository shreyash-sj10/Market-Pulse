export const ROUTES = {
  landing: "/",
  creator: "/creator",
  login: "/login",
  register: "/register",
  dashboard: "/dashboard",
  markets: "/markets",
  portfolio: "/portfolio",
  journal: "/journal",
  profile: "/profile",
  trace: "/trace",
} as const;

export type AppRoute = (typeof ROUTES)[keyof typeof ROUTES];
