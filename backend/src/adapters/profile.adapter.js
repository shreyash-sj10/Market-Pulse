const { adaptJournal } = require("./journal.adapter");

const adaptProfile = (user, tradeStats, recentJournalEntries, profileSurface = null) => {
  return {
    totalTrades: tradeStats.totalTrades || 0,
    winRate: tradeStats.winRate || 0,
    skillScore: user.analyticsSnapshot?.skillScore || 0,
    disciplineScore:
      typeof user.analyticsSnapshot?.disciplineScore === "number"
        ? user.analyticsSnapshot.disciplineScore
        : null,
    trend: user.analyticsSnapshot?.trend || "STABLE",
    tags: Array.isArray(user.analyticsSnapshot?.tags) ? user.analyticsSnapshot.tags : [],
    surface: profileSurface,
    recentLearning: recentJournalEntries.map((entry) => {
      const surface = adaptJournal(entry);
      return {
        symbol: entry.symbol || "UNKNOWN",
        ...surface,
      };
    }),
  };
};

module.exports = { adaptProfile };
