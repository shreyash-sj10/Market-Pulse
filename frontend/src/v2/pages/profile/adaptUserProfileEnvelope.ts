export type BehaviorPatternSurface = {
  type: string;
  count: number;
  confidence: number;
};

export type ProfilePatternTally = {
  earlyExit: number;
  overtrading: number;
  missedEntry: number;
};

export type ProfileSurfaceDto = {
  maxDrawdownPct: number | null;
  avgRiskPerTradePct: number | null;
  consistencyScore: number | null;
  patternTally: ProfilePatternTally;
  behaviorPatterns: BehaviorPatternSurface[];
  behaviorDisciplineScore: number | null;
};

export type EnforcedRiskFloorMeta = {
  minRewardToRisk: number;
  revengeCooldownMinutes: number;
  maxClientPriceDriftPct: number;
};

export type UserProfileEnvelope = {
  totalTrades: number;
  winRate: number;
  skillScore: number;
  disciplineScore: number | null;
  trend: string;
  tags: string[];
  surface: ProfileSurfaceDto | null;
  profileState: string | null;
  enforcedRiskFloor: EnforcedRiskFloorMeta | null;
  /** ISO strings from API meta — for “last activity” */
  analyticsSnapshotLastUpdated: string | null;
  analyticsLastUpdatedAt: string | null;
  degraded: boolean;
  fetchFailed: boolean;
};

function asRecord(v: unknown): Record<string, unknown> | null {
  if (!v || typeof v !== "object" || Array.isArray(v)) return null;
  return v as Record<string, unknown>;
}

function numOrNull(v: unknown): number | null {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function parseSurface(raw: unknown): ProfileSurfaceDto | null {
  const o = asRecord(raw);
  if (!o) return null;
  const tally = asRecord(o.patternTally);
  const patternsRaw = Array.isArray(o.behaviorPatterns) ? o.behaviorPatterns : [];
  const behaviorPatterns: BehaviorPatternSurface[] = patternsRaw
    .map((p) => {
      const pr = asRecord(p);
      if (!pr || typeof pr.type !== "string") return null;
      return {
        type: pr.type,
        count: Number(pr.count) || 0,
        confidence: Number(pr.confidence) || 0,
      };
    })
    .filter((x): x is BehaviorPatternSurface => x !== null);

  return {
    maxDrawdownPct: numOrNull(o.maxDrawdownPct),
    avgRiskPerTradePct: numOrNull(o.avgRiskPerTradePct),
    consistencyScore: numOrNull(o.consistencyScore),
    patternTally: {
      earlyExit: Number(tally?.earlyExit) || 0,
      overtrading: Number(tally?.overtrading) || 0,
      missedEntry: Number(tally?.missedEntry) || 0,
    },
    behaviorPatterns,
    behaviorDisciplineScore: numOrNull(o.behaviorDisciplineScore),
  };
}

function parseEnforcedFloor(meta: Record<string, unknown> | null): EnforcedRiskFloorMeta | null {
  const raw = meta && asRecord(meta.enforcedRiskFloor);
  if (!raw) return null;
  const minRewardToRisk = Number(raw.minRewardToRisk);
  const revengeCooldownMinutes = Number(raw.revengeCooldownMinutes);
  const maxClientPriceDriftPct = Number(raw.maxClientPriceDriftPct);
  if (!Number.isFinite(minRewardToRisk) || !Number.isFinite(revengeCooldownMinutes)) return null;
  return {
    minRewardToRisk,
    revengeCooldownMinutes,
    maxClientPriceDriftPct: Number.isFinite(maxClientPriceDriftPct) ? maxClientPriceDriftPct : 0.005,
  };
}

/**
 * Normalizes GET /users/profile body (axios `data`) into a typed envelope.
 */
export function adaptUserProfileEnvelope(body: unknown): UserProfileEnvelope {
  if (body == null) {
    return {
      totalTrades: 0,
      winRate: 0,
      skillScore: 0,
      disciplineScore: null,
      trend: "STABLE",
      tags: [],
      surface: null,
      profileState: null,
      enforcedRiskFloor: null,
      analyticsSnapshotLastUpdated: null,
      analyticsLastUpdatedAt: null,
      degraded: false,
      fetchFailed: true,
    };
  }

  const root = asRecord(body);
  const degraded = Boolean(root?.degraded);
  const data = asRecord(root?.data);
  const meta = asRecord(root?.meta);

  if (!data) {
    return {
      totalTrades: 0,
      winRate: 0,
      skillScore: 0,
      disciplineScore: null,
      trend: "STABLE",
      tags: [],
      surface: null,
      profileState: meta?.profileState != null ? String(meta.profileState) : null,
      enforcedRiskFloor: parseEnforcedFloor(meta),
      analyticsSnapshotLastUpdated: meta?.analyticsSnapshotLastUpdated != null ? String(meta.analyticsSnapshotLastUpdated) : null,
      analyticsLastUpdatedAt: meta?.analyticsLastUpdatedAt != null ? String(meta.analyticsLastUpdatedAt) : null,
      degraded,
      fetchFailed: true,
    };
  }

  const tags = Array.isArray(data.tags) ? data.tags.map((t) => String(t)) : [];

  return {
    totalTrades: Number(data.totalTrades) || 0,
    winRate: Number(data.winRate) || 0,
    skillScore: Number(data.skillScore) || 0,
    disciplineScore: numOrNull(data.disciplineScore),
    trend: String(data.trend || "STABLE"),
    tags,
    surface: parseSurface(data.surface),
    profileState: meta?.profileState != null ? String(meta.profileState) : null,
    enforcedRiskFloor: parseEnforcedFloor(meta),
    analyticsSnapshotLastUpdated: meta?.analyticsSnapshotLastUpdated != null ? String(meta.analyticsSnapshotLastUpdated) : null,
    analyticsLastUpdatedAt: meta?.analyticsLastUpdatedAt != null ? String(meta.analyticsLastUpdatedAt) : null,
    degraded,
    fetchFailed: false,
  };
}
