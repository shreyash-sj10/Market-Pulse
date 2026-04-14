export type LearningSurface = {
  verdict: string;
  primaryMistake: string;
  insight: string;
  correction: string;
  confidence: number;
  tags: string[];
};

export type JournalEntry = {
  symbol: string;
  pnlPaise: number;
  pnlPct: number;
  openedAt: string;
  closedAt: string;
  plan: {
    entry: number;
    sl: number;
    target: number;
  };
  actual: {
    entry: number;
    exit: number;
  };
  learningSurface: LearningSurface;
};

export type JournalSummary = {
  totalClosed: number;
  frequentPatterns: Array<{
    type: string;
    count: number;
    frequency: number;
  }>;
  entries: JournalEntry[];
};
