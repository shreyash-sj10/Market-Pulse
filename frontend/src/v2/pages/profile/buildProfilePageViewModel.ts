import type { JournalPageStatus } from "../../hooks/useJournalDecisions";
import type { UserProfileEnvelope } from "./adaptUserProfileEnvelope";
import { buildProfileBehaviorModel } from "./buildProfileBehaviorModel";
import { buildProfileBehaviorInsights } from "./buildProfileBehaviorInsights";
import { buildProfileEnforcementLines } from "./buildProfileEnforcementLines";

export type ProfileIdentityRow = {
  username: string;
  connectionStatus: "SYNC" | "LIVE" | "DEGRADED" | "OFFLINE";
  behaviorModelStatus: "NONE" | "PARTIAL" | "STALE" | "ACTIVE";
  tradesLoggedDisplay: string;
  lastActivityDisplay: string;
};

export type ProfileStateStrip = {
  winRateDisplay: string;
  avgRiskDisplay: string;
  maxDrawdownDisplay: string;
  consistencyDisplay: string;
};

export type ProfilePatternSummaryLine = string;

export type ProfilePageViewModel = {
  loading: boolean;
  /** True when neither trades nor journal surfaces exist */
  isEmpty: boolean;
  profileStale: boolean;
  journalDegraded: boolean;
  profileDegraded: boolean;
  identity: ProfileIdentityRow;
  stateStrip: ProfileStateStrip;
  insights: ReturnType<typeof buildProfileBehaviorInsights>;
  enforcementLines: string[];
  patternSummaryLines: ProfilePatternSummaryLine[];
};

function pctDisplay(n: number | null | undefined, fallback = "—"): string {
  if (n == null || !Number.isFinite(n)) return fallback;
  return `${Number(n.toFixed(n >= 10 ? 0 : 1))}%`;
}

function scoreDisplay(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return `${Math.round(n)}`;
}

function formatActivity(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return null;
  return new Date(t).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

export function buildProfilePageViewModel(
  journal: JournalPageStatus,
  profile: UserProfileEnvelope | null,
  profileLoading: boolean,
  operator: { username: string },
): ProfilePageViewModel {
  const loading = journal.isLoading || profileLoading;
  const surface = profile?.surface ?? null;

  const behaviorModel =
    journal.logs.length > 0 ? buildProfileBehaviorModel(journal.logs, journal.engine) : null;

  const hasTrades = (profile?.totalTrades ?? 0) > 0;
  const hasJournal = journal.logs.length > 0;
  const isEmpty = !loading && !hasTrades && !hasJournal;

  const profileStale = profile?.profileState === "STALE";
  let connectionStatus: ProfileIdentityRow["connectionStatus"] = "SYNC";
  if (!loading) {
    const profileDead = Boolean(profile?.fetchFailed);
    const journalDead = journal.isError;
    if (profileDead && journalDead) connectionStatus = "OFFLINE";
    else if (profileDead || journalDead || profile?.degraded || journal.isDegraded) {
      connectionStatus = "DEGRADED";
    } else connectionStatus = "LIVE";
  }

  let behaviorModelStatus: ProfileIdentityRow["behaviorModelStatus"] = "NONE";
  if (!isEmpty) {
    if (profileStale) behaviorModelStatus = "STALE";
    else if (hasTrades && !hasJournal) behaviorModelStatus = "PARTIAL";
    else behaviorModelStatus = "ACTIVE";
  }

  const lastFromMeta =
    formatActivity(profile?.analyticsLastUpdatedAt) || formatActivity(profile?.analyticsSnapshotLastUpdated);
  const lastActivityDisplay =
    lastFromMeta || (hasJournal ? journal.logs[0]?.dateLabel ?? "—" : "—");

  const identity: ProfileIdentityRow = {
    username: operator.username.trim() || "Operator",
    connectionStatus,
    behaviorModelStatus,
    tradesLoggedDisplay: String(profile?.totalTrades ?? 0),
    lastActivityDisplay,
  };

  const patterns = surface?.behaviorPatterns ?? [];

  const insights = buildProfileBehaviorInsights(
    patterns,
    journal.engine,
    journal.logs,
    behaviorModel,
    journal.behavioral,
    { winRate: profile?.winRate ?? 0, totalTrades: profile?.totalTrades ?? 0 },
  );

  const enforcementLines = buildProfileEnforcementLines(
    behaviorModel,
    journal.behavioral,
    profile?.enforcedRiskFloor ?? null,
  );

  const tally = surface?.patternTally ?? { earlyExit: 0, overtrading: 0, missedEntry: 0 };
  const patternSummaryLines: ProfilePatternSummaryLine[] = [
    `Early exits — ${tally.earlyExit} flagged instance(s) in the last behavior scan.`,
    `Overtrading — ${tally.overtrading} density / burst signal(s) on record for this window.`,
    `Missed / chase entries — ${tally.missedEntry} FOMO or price-chase marker(s) detected.`,
  ];

  const winRateDisplay = hasTrades || (profile?.winRate ?? 0) > 0 ? pctDisplay(profile?.winRate ?? 0, "0%") : "—";
  const avgRiskDisplay = pctDisplay(surface?.avgRiskPerTradePct ?? null);
  const maxDrawdownDisplay = pctDisplay(surface?.maxDrawdownPct ?? null);
  const consistencyDisplay = scoreDisplay(surface?.consistencyScore ?? profile?.disciplineScore ?? null);

  return {
    loading,
    isEmpty,
    profileStale,
    journalDegraded: journal.isDegraded,
    profileDegraded: Boolean(profile?.degraded) || Boolean(profile?.fetchFailed),
    identity,
    stateStrip: {
      winRateDisplay,
      avgRiskDisplay,
      maxDrawdownDisplay,
      consistencyDisplay,
    },
    insights,
    enforcementLines,
    patternSummaryLines,
  };
}
