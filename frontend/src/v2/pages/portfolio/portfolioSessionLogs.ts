import type { EventLogEntryVM } from "../home/mapHomeViewModel";

function formatClock(d: Date): string {
  return d.toLocaleTimeString("en-IN", {
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

/**
 * Deterministic portfolio-side log lines so the rail reads as a system surface
 * even when the trace stream is empty or sparse.
 */
export function buildPortfolioSessionLogs(input: {
  positionCount: number;
  breachCount: number;
  atRiskCount: number;
  /** Epoch ms anchor so timestamps advance logically in one paint */
  anchorMs: number;
}): EventLogEntryVM[] {
  const { positionCount, breachCount, atRiskCount, anchorMs } = input;
  const out: EventLogEntryVM[] = [];

  out.push({
    id: "pf-session-load",
    time: formatClock(new Date(anchorMs)),
    type: "INFO",
    message: `Portfolio loaded (${positionCount} position${positionCount === 1 ? "" : "s"})`,
  });

  if (breachCount > 0) {
    out.push({
      id: "pf-session-breach",
      time: formatClock(new Date(anchorMs + 2000)),
      type: "WARN",
      message: `${breachCount} position${breachCount === 1 ? "" : "s"} in breach state`,
    });
  } else if (atRiskCount > 0) {
    out.push({
      id: "pf-session-risk",
      time: formatClock(new Date(anchorMs + 2000)),
      type: "WARN",
      message: `${atRiskCount} position${atRiskCount === 1 ? "" : "s"} approaching plan limits`,
    });
  }

  let posture: string;
  if (breachCount > 0) posture = "defensive";
  else if (atRiskCount > 0) posture = "elevated";
  else if (positionCount > 0) posture = "aligned";
  else posture = "idle";

  out.push({
    id: "pf-session-posture",
    time: formatClock(new Date(anchorMs + 4000)),
    type: "CHECK",
    message: `Risk posture: ${posture}`,
  });

  return out;
}
