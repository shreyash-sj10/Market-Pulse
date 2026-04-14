import type { LearningSurface } from "./journal";

export type ProfileLearningEntry = LearningSurface & {
  symbol: string;
};

export type ProfileData = {
  totalTrades: number;
  winRate: number;
  skillScore: number;
  tags: string[];
  recentLearning: ProfileLearningEntry[];
};
