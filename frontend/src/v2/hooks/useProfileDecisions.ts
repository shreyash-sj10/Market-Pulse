/**
 * useProfileDecisions — fetches real behavioral improvements from /users/profile.
 * No mock data. Empty profile → empty items.
 */
import { useQuery } from "@tanstack/react-query";
import { getUserProfile } from "../api/user.api.js";
import { queryKeys } from "../queryKeys";
import type { DecisionCardProps } from "../components/decision/DecisionCard";
import { buildDecision } from "../domain/decision/buildDecision";
import type { BuildDecisionInput } from "../domain/decision/buildDecision";
import { applyInsightFeedback } from "../behavior";
import type { DecisionListStatus } from "../types/decisionUi";

type ProfileSeed = BuildDecisionInput & { label: string; note: string };

function extractProfile(res: unknown): Record<string, unknown> | null {
  if (!res || typeof res !== "object") return null;
  const r = res as Record<string, unknown>;
  const data = r.data as Record<string, unknown> | undefined;
  return (data && typeof data === "object") ? data : null;
}

function learningSortTime(item: Record<string, unknown>): number {
  const t = item.updatedAt ?? item.createdAt ?? item.timestamp;
  return t ? new Date(String(t)).getTime() : 0;
}

function mapLearningToSeed(item: Record<string, unknown>, index: number): ProfileSeed | null {
  const label = String(item.primaryMistake ?? item.symbol ?? "").trim();
  const note  = String(item.insight ?? item.correction ?? "").trim();

  if (!label && !note) return null;

  const confidence = Number(item.confidence ?? 50);
  const riskScore  = Math.min(100, Math.max(0, Math.round(Number.isFinite(confidence) ? confidence : 50)));
  const tags       = Array.isArray(item.tags) ? item.tags : [];

  return {
    label:    label || `Improvement ${index + 1}`,
    note:     note  || "Review this pattern before next trade.",
    allowed:  true,
    riskScore,
    warnings: tags.length > 0 ? (tags as string[]) : false,
  };
}

export type ProfileFetchResult = {
  rows:        ProfileSeed[];
  degraded:    boolean;
  fetchFailed: boolean;
};

export async function fetchProfileImprovementSeeds(): Promise<ProfileFetchResult> {
  try {
    const res     = await getUserProfile();
    const profile = extractProfile(res);
    const raw     = profile?.recentLearning;
    const list    = Array.isArray(raw) ? raw : [];

    const sorted = [...list].sort(
      (a, b) => learningSortTime(b as Record<string, unknown>) - learningSortTime(a as Record<string, unknown>),
    );

    const rows = sorted
      .map((e, i) => mapLearningToSeed(e as Record<string, unknown>, i))
      .filter((x): x is ProfileSeed => x !== null);

    return { rows, degraded: false, fetchFailed: false };
  } catch {
    return { rows: [], degraded: true, fetchFailed: true };
  }
}

function seedsToCardProps(rows: ProfileSeed[]): DecisionCardProps[] {
  return rows.map((r) => {
    const { label, note, ...input } = r;
    const decision = buildDecision(input);
    return {
      title:           label,
      decision,
      meta:            { journalInsight: note },
      onPrimaryAction: applyInsightFeedback,
    };
  });
}

async function loadProfile(): Promise<DecisionListStatus> {
  const { rows, degraded, fetchFailed } = await fetchProfileImprovementSeeds();
  return {
    items:      seedsToCardProps(rows),
    source:     degraded || fetchFailed ? "fallback" : "api",
    isLoading:  false,
    isError:    fetchFailed,
    isDegraded: degraded,
  };
}

export function useProfileDecisions(): DecisionListStatus {
  const q = useQuery({
    queryKey: queryKeys.profile,
    queryFn:  loadProfile,
    staleTime: 0,
  });

  if (q.isPending && !q.data) {
    return { items: [], source: "api", isLoading: true, isError: false, isDegraded: false };
  }

  return q.data ?? { items: [], source: "fallback", isLoading: false, isError: true, isDegraded: false };
}
