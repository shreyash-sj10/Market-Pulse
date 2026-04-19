import type { NewsSignal } from "../../hooks/useMarketNews";

const LEADING_ADVICE = /^\s*(buy|sell|go long|go short|accumulate|trim|add|exit)\b[.:]?\s+/i;

/**
 * 2–3 news-only lines for the workspace — no tape/technicals; soft filter on imperative trade lines.
 */
export function buildIntelligenceBullets(signals: NewsSignal[], max = 3): string[] {
  const out: string[] = [];
  for (const sig of signals) {
    if (out.length >= max) break;
    const raw =
      (typeof sig.impact === "string" && sig.impact.trim()) ||
      (typeof sig.judgment === "string" && sig.judgment.trim()) ||
      (typeof sig.event === "string" && sig.event.trim()) ||
      "";
    let s = raw.replace(/\s+/g, " ").trim();
    if (!s) continue;
    if (LEADING_ADVICE.test(s)) {
      s = s.replace(LEADING_ADVICE, "").trim();
    }
    if (!s) continue;
    if (s.length > 160) s = `${s.slice(0, 157).trim()}…`;
    out.push(s);
  }
  return out.slice(0, max);
}
