const { adaptJournal } = require("./journal.adapter");

const adaptProfile = (user, tradeStats, recentJournalEntries) => {
  return {
    totalTrades: tradeStats.totalTrades || 0,
    winRate: tradeStats.winRate || 0,
    skillScore: user.analyticsSnapshot?.skillScore || 0,
    tags: Array.isArray(user.analyticsSnapshot?.tags) ? user.analyticsSnapshot.tags : [],
    recentLearning: recentJournalEntries.map(entry => {
      const surface = adaptJournal(entry);
      return {
        symbol: entry.symbol || "UNKNOWN",
        ...surface
      };
    })
  };
};

module.exports = { adaptProfile };
