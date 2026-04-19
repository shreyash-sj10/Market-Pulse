const Trade = require("../models/trade.model");
const User = require("../models/user.model");
const { normalizeTrade } = require("../domain/trade.contract");
const { mapToClosedTrades } = require("../domain/closedTrade.mapper");
const { analyzeReflection } = require("../engines/reflection.engine");
const { analyzeBehavior } = require("./behavior.engine");
const { analyzeProgression } = require("./progression.engine");
const { calculateSkillScore } = require("./skill.engine");
const { generatePatternInsight } = require("./patternInsight.service");
const logger = require("../utils/logger");

const DEFAULT_HISTORY_LIMIT = 100;

/**
 * Heavy portfolio analytics from trade history (must run outside execution / reflection transactions).
 */
async function computeUserAnalytics(userId, options = {}) {
  const limit = options.limit ?? DEFAULT_HISTORY_LIMIT;
  const history = await Trade.find({ user: userId })
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();

  const chronHistory = [...history].reverse();
  const normalizedHistory = chronHistory.map((t) => normalizeTrade(t));
  const closed = mapToClosedTrades(normalizedHistory);

  const reflections = closed
    .map((ct) => {
      try {
        return analyzeReflection(ct);
      } catch (e) {
        logger.warn({ action: "ANALYTICS_REFLECTION_SKIPPED", tradeId: ct?.id, reason: e.message });
        return null;
      }
    })
    .filter(Boolean);

  const behavior = analyzeBehavior(closed);
  const progression = analyzeProgression(closed);
  const skill = calculateSkillScore(closed, reflections, behavior, progression);

  const tags = [
    ...new Set([
      ...(behavior.patterns || []).map((p) => p.type),
      ...skill.strengths,
      ...skill.weaknesses,
    ]),
  ];

  const discipline = behavior.disciplineScore || skill.breakdown?.discipline || 0;

  const snapshot = {
    skillScore: skill.score,
    disciplineScore: discipline,
    trend: progression.trend || "STABLE",
    tags,
    lastUpdated: new Date(),
    patternInsight: generatePatternInsight({
      tags,
      totalTrades: closed.length,
      winRate: behavior.winRate || 0,
      avgPnlPct: behavior.avgPnlPct || 0,
      disciplineScore: discipline,
    }),
    behaviorTags: [...new Set((behavior.patterns || []).map((p) => p.type))],
    skillStrengths: [...new Set(skill.strengths || [])],
    skillWeaknesses: [...new Set(skill.weaknesses || [])],
  };

  return { snapshot, closed, skill, behavior, progression, reflections };
}

async function persistUserAnalyticsSnapshot(userId) {
  if (!userId) return;
  const uid = String(userId);
  const exists = await User.exists({ _id: uid });
  if (!exists) return;

  const { snapshot } = await computeUserAnalytics(uid);
  const now = new Date();
  snapshot.lastUpdated = now;

  await User.updateOne(
    { _id: uid },
    { $set: { analyticsSnapshot: snapshot, analyticsLastUpdatedAt: now } }
  );
}

module.exports = {
  computeUserAnalytics,
  persistUserAnalyticsSnapshot,
};
