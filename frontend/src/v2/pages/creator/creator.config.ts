/**
 * Public creator / contact links. Override via Vite env for local deploys.
 * Repo URL matches README CI badge (shreyash-beyond/trading-platform).
 */
const env = import.meta.env;

export const CREATOR_CONFIG = {
  name: "Shreyash Jadhav",
  /** Optional absolute URL to a portrait (e.g. CDN or `/creator-portrait.jpg` in `public/`). */
  portraitUrl: (env.VITE_CREATOR_PORTRAIT as string | undefined)?.trim() || "",
  /** Short line under the name in the hero. */
  roleLine: "Full-stack engineer · deterministic systems · behavioral intelligence",
  githubProfile: "https://github.com/shreyash-beyond",
  githubRepo: "https://github.com/shreyash-beyond/trading-platform",
  /** Override with `VITE_CREATOR_LINKEDIN` if the default profile URL is wrong. */
  linkedIn:
    (env.VITE_CREATOR_LINKEDIN as string | undefined)?.trim() ||
    "https://www.linkedin.com/in/shreyash-jadhav",
  email: (env.VITE_CREATOR_EMAIL as string | undefined)?.trim() || "",
} as const;
