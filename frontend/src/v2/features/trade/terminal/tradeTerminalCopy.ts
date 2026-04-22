import type { Decision } from "../../../domain/decision/buildDecision";

/** Display-only — same vocabulary as Markets / Home decision surfaces. */
export function marketPostureLabel(action: Decision["action"]): string {
  if (action === "ACT") return "Valid trade";
  if (action === "BLOCK") return "Avoid";
  return "Wait";
}
