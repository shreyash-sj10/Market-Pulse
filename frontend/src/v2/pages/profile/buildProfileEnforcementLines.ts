import type { ProfileBehaviorModel } from "./buildProfileBehaviorModel";
import type { BehavioralGuidanceModel } from "../journal/journalIntelligence";
import type { EnforcedRiskFloorMeta } from "./adaptUserProfileEnvelope";

/**
 * Strict, system-authored lines (not suggestions).
 */
export function buildProfileEnforcementLines(
  model: ProfileBehaviorModel | null,
  behavioral: BehavioralGuidanceModel,
  floor: EnforcedRiskFloorMeta | null,
): string[] {
  const lines: string[] = [];

  if (floor) {
    lines.push(
      `Revenge cooldown — same-symbol re-entry within ${floor.revengeCooldownMinutes} minutes of a loss-class close is BLOCKED until pre-trade authority issues a new token.`,
    );
    lines.push(
      `Reward:risk floor — plans below ${floor.minRewardToRisk}:1 do not clear entry scoring; submissions below floor are REJECTED at judgment.`,
    );
    const driftPct = (floor.maxClientPriceDriftPct * 100).toFixed(2);
    lines.push(
      `Live vs client price drift beyond ${driftPct}% — executable orders HALT at gateway until price is refreshed.`,
    );
  }

  if (model) {
    for (const row of model.enforcementRows) {
      const on = row.engaged ? "ACTIVE" : "LATENT";
      lines.push(`${row.control.toUpperCase()} — ${row.status} (${on}).`);
    }
    lines.push(model.constraintFeedback.scalingLine);
  }

  const act = behavioral.systemAction.trim();
  if (act && !lines.some((l) => l.includes(act.slice(0, 24)))) {
    lines.push(act);
  }

  // De-dupe while preserving order
  const seen = new Set<string>();
  return lines.filter((l) => {
    const k = l.trim().toLowerCase();
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}
