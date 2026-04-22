import { useMemo } from "react";
import AppLayout from "../../layout/AppLayout/AppLayout.jsx";
import { useJournalPage } from "../../hooks/useJournalDecisions";
import {
  clampScore,
  inferPatternFromReportBlob,
  toneFromLog,
} from "../../domain/behavior/tradeBehaviorModel";

type PatternKey = "disciplined" | "revenge" | "early_exit" | "panic" | "holding_losers";
type ReportCard = { score: number; pattern: PatternKey; tone: "good" | "bad" | "warn"; dateLabel: string };

function label(k: PatternKey): string {
  if (k === "disciplined") return "Disciplined";
  if (k === "revenge") return "Revenge";
  if (k === "early_exit") return "Early Exit";
  if (k === "panic") return "Panic";
  return "Holding losers";
}

type WeeklyVerdict = "Improving" | "Stable" | "Unstable";

type ConfidenceLevel = "HIGH" | "MEDIUM" | "LOW";

export default function WeeklyDisciplineReportPage() {
  const journal = useJournalPage();

  const cards = useMemo<ReportCard[]>(
    () =>
      journal.logs.map((log) => {
        const tone = toneFromLog(log.decisionAction, log.confidence, log.archetype);
        const blob = `${log.centerPrimary} ${log.behavioralWhy} ${log.correctionBullets.join(" ")}`;
        return {
          score: clampScore(log.confidence),
          pattern: inferPatternFromReportBlob(blob, tone, log.archetype),
          tone,
          dateLabel: log.dateLabel,
        };
      }),
    [journal.logs],
  );

  const recentWeek = cards.slice(0, 7);
  const previousWeek = cards.slice(7, 14);
  const weeklyScore = recentWeek.length > 0 ? Math.round(recentWeek.reduce((s, c) => s + c.score, 0) / recentWeek.length) : 0;
  const prevWeeklyScore =
    previousWeek.length > 0 ? Math.round(previousWeek.reduce((s, c) => s + c.score, 0) / previousWeek.length) : null;
  const delta = prevWeeklyScore == null ? null : weeklyScore - prevWeeklyScore;

  const trend = useMemo(() => recentWeek.slice().reverse(), [recentWeek]);
  const patternBreakdown = useMemo(() => {
    const keys: PatternKey[] = ["disciplined", "panic", "early_exit", "revenge", "holding_losers"];
    return keys.map((k) => ({
      key: k,
      label: label(k),
      count: recentWeek.filter((c) => c.pattern === k).length,
    }));
  }, [recentWeek]);

  const dominantPattern = useMemo(
    () => [...patternBreakdown].sort((a, b) => b.count - a.count)[0],
    [patternBreakdown],
  );

  const disciplinedCount = useMemo(
    () => recentWeek.filter((c) => c.pattern === "disciplined").length,
    [recentWeek],
  );
  const deviationCount = Math.max(0, recentWeek.length - disciplinedCount);
  const badCount = useMemo(
    () => recentWeek.filter((c) => c.tone === "bad").length,
    [recentWeek],
  );
  const trendDelta = useMemo(() => {
    if (trend.length < 2) return null;
    const first = trend[0]?.score ?? 0;
    const last = trend[trend.length - 1]?.score ?? 0;
    return Math.round(last - first);
  }, [trend]);

  const confidenceLevel: ConfidenceLevel = useMemo(() => {
    if (recentWeek.length >= 6) return "HIGH";
    if (recentWeek.length >= 3) return "MEDIUM";
    return "LOW";
  }, [recentWeek.length]);

  const verdict: WeeklyVerdict = useMemo(() => {
    if (recentWeek.length === 0) return "Stable";
    if ((delta != null && delta >= 5) || (trendDelta != null && trendDelta >= 6)) return "Improving";
    if (weeklyScore >= 68 && badCount <= 2) return "Stable";
    return "Unstable";
  }, [recentWeek.length, delta, trendDelta, weeklyScore, badCount]);

  const verdictInterpretation = useMemo(() => {
    if (recentWeek.length === 0) return "Low confidence baseline — no closed trades in this weekly window.";
    if (verdict === "Improving") return "Stabilizing behavior with better execution alignment versus last week.";
    if (verdict === "Stable") return "Controlled behavior quality with manageable deviation pressure.";
    return "High risk week — deviation clusters are reducing discipline reliability.";
  }, [recentWeek.length, verdict]);

  const systemPosition = useMemo(() => {
    if (verdict === "Improving") return "System position: Stabilizing — continue controlled execution without risk escalation.";
    if (verdict === "Stable") return "System position: Controlled — maintain process and tighten weak spots.";
    return "System position: High risk — reduce discretion and enforce strict rule compliance.";
  }, [verdict]);

  const trendInterpretation = useMemo(() => {
    if (trend.length < 2) return "Insufficient data to establish a reliable weekly slope.";
    if (trendDelta == null || Math.abs(trendDelta) < 3) return "Weekly behavior trend is flat; hold process discipline.";
    if (trendDelta > 0) return `Behavior trend is improving (+${trendDelta}) with stronger execution alignment.`;
    return `Behavior trend is weakening (${trendDelta}) with deviation pressure increasing.`;
  }, [trend.length, trendDelta]);

  const topInsights = useMemo(() => {
    const bad = recentWeek.filter((c) => c.tone === "bad").length;
    const disciplined = recentWeek.filter((c) => c.pattern === "disciplined").length;
    const panic = recentWeek.filter((c) => c.pattern === "panic").length;
    const earlyExit = recentWeek.filter((c) => c.pattern === "early_exit").length;
    return [
      `${disciplined}/${Math.max(1, recentWeek.length)} trades closed as execution aligned.`,
      `${bad} high-risk closes flagged this week.`,
      `Primary friction: ${panic >= earlyExit ? "panic exits" : "early exits"} pattern repeats.`,
    ];
  }, [recentWeek]);

  const actionPlan = useMemo((): { directive: string; rules: string[]; targetOutcome: string } => {
    if (!dominantPattern || dominantPattern.key === "disciplined") {
      return {
        directive: "Preserve controlled execution cadence.",
        rules: [
          "Maintain full stop/target compliance for the next 5 trades.",
          "Keep thesis quality high and avoid discretionary overrides.",
          "Scale only after checklist is fully green.",
        ],
        targetOutcome: "Target >= 5/7 execution-aligned closes in the next weekly window.",
      };
    }
    if (dominantPattern.key === "panic") {
      return {
        directive: "Stabilize exits under pressure.",
        rules: [
          "Enforce minimum hold duration for next 3 trades before discretionary exit.",
          "Pre-define exits and do not override in the first 10 minutes.",
          "Document one panic trigger after each close.",
        ],
        targetOutcome: "Reduce panic-pattern closes by at least 50% next week.",
      };
    }
    if (dominantPattern.key === "early_exit") {
      return {
        directive: "Restore target discipline.",
        rules: [
          "Execute predefined stop/target on next 3 setups.",
          "Do not cut profits before objective unless risk rule triggers.",
          "Log one concrete reason whenever target is not respected.",
        ],
        targetOutcome: "Increase execution-aligned exits and reduce premature closes next week.",
      };
    }
    if (dominantPattern.key === "revenge") {
      return {
        directive: "Break re-entry impulse loop.",
        rules: [
          "Apply a cooldown after any loss before next entry.",
          "Require full checklist pass before same-session re-entry.",
          "Limit size to 1 unit until three clean closes.",
        ],
        targetOutcome: "Eliminate revenge-tagged closes in the next weekly cycle.",
      };
    }
    return {
      directive: "Reinforce loss-control discipline.",
      rules: [
        "Re-state stop and target before every entry.",
        "Do not add to positions violating exit plan.",
        "Force hard review on any holding-loser close.",
      ],
      targetOutcome: "Lower holding-loser count and improve weekly discipline stability.",
    };
  }, [dominantPattern]);

  const patternInterpretation = useMemo(() => {
    if (recentWeek.length === 0) return "No pattern evidence in this window yet.";
    if (disciplinedCount >= Math.ceil(recentWeek.length * 0.6)) {
      return "Behavior quality is controlled with a majority of execution-aligned closes.";
    }
    if (deviationCount >= Math.ceil(recentWeek.length * 0.5)) {
      return "Behavior quality is unstable with deviation concentration in the latest week.";
    }
    return "Behavior quality is mixed; system remains in stabilizing mode.";
  }, [recentWeek.length, disciplinedCount, deviationCount]);

  const confidenceReason = useMemo(() => {
    if (confidenceLevel === "HIGH") return `${recentWeek.length}/7 trades available in window.`;
    if (confidenceLevel === "MEDIUM") return `${recentWeek.length}/7 trades available — signal still forming.`;
    return `${recentWeek.length}/7 trades available — low sample reliability.`;
  }, [confidenceLevel, recentWeek.length]);

  const confidenceAction = useMemo(() => {
    if (confidenceLevel === "HIGH") return "Use this verdict as primary weekly operating posture.";
    if (confidenceLevel === "MEDIUM") return "Follow plan but re-validate after additional closes this week.";
    return "Log more closed trades before increasing confidence in directional changes.";
  }, [confidenceLevel]);

  const badges = useMemo(() => {
    const out: string[] = [];
    if (recentWeek.filter((c) => c.pattern === "disciplined").length >= 5) out.push("Protocol Keeper");
    if (delta != null && delta >= 8) out.push("Recovery Momentum");
    if (recentWeek.filter((c) => c.tone !== "bad").length >= 6) out.push("Stability Week");
    return out;
  }, [recentWeek, delta]);

  const w = 780;
  const h = 180;
  const px = 16;
  const py = 12;
  const cw = w - px * 2;
  const ch = h - py * 2;
  const step = cw / Math.max(1, trend.length - 1);
  const path = trend
    .map((p, i) => `${i === 0 ? "M" : "L"} ${px + i * step} ${py + ch - (p.score / 100) * ch}`)
    .join(" ");

  return (
    <AppLayout>
      <div className="home-terminal weekly-report">
        <header className="weekly-report__head">
          <h1>Weekly Discipline Report</h1>
          <p>System verdict, correction plan, and behavioral evidence for this weekly window.</p>
        </header>

        <section className="weekly-report__score border-slate-700 bg-slate-900/70">
          <div className="col-span-2 rounded-md border border-slate-800/80 bg-slate-950/50 p-3 md:col-span-3">
            <p className="weekly-report__k">Weekly verdict</p>
            <h2 className="text-2xl font-bold tracking-tight text-slate-100">{verdict}</h2>
            <p className="mt-1 text-sm text-slate-300">{verdictInterpretation}</p>
            <p className="mt-2 text-xs font-medium text-cyan-300">{systemPosition}</p>
          </div>
          <div className="rounded-md border border-slate-800/80 bg-slate-950/40 p-3">
            <p className="weekly-report__k">Score</p>
            <p className="mt-1 text-xl font-semibold tabular-nums text-slate-100">{weeklyScore}</p>
          </div>
          <div className="rounded-md border border-slate-800/80 bg-slate-950/40 p-3">
            <p className="weekly-report__k">Confidence</p>
            <p className="mt-1 text-xl font-semibold tabular-nums text-slate-100">{confidenceLevel}</p>
          </div>
          <div className="weekly-report__delta rounded-md border border-slate-800/80 bg-slate-950/40 p-3">
            <p className="weekly-report__k">Delta vs previous week</p>
            <p className="mt-1 text-xl font-semibold tabular-nums text-slate-100">
              {delta == null ? "N/A" : `${delta > 0 ? "+" : ""}${delta}`}
            </p>
          </div>
          {badges.length > 0 ? (
            <div className="weekly-report__badges md:col-span-3">
              {badges.map((b) => (
                <span key={b}>{b}</span>
              ))}
            </div>
          ) : null}
        </section>

        <section className="weekly-report__panel">
          <h3>7-day trend</h3>
          <p className="mt-2 text-xs text-slate-300">{trendInterpretation}</p>
          <p className="mt-1 text-xs text-slate-500">
            Data sufficiency: {recentWeek.length >= 5 ? "Sufficient" : "Limited"} ({recentWeek.length}/7 trades)
          </p>
          {trend.length > 1 ? (
            <svg className="weekly-report__chart" viewBox={`0 0 ${w} ${h}`} role="img" aria-label="7-day behavior trend">
              {[25, 50, 75].map((s) => {
                const y = py + ch - (s / 100) * ch;
                return <line key={s} x1={px} x2={px + cw} y1={y} y2={y} className="weekly-report__grid" />;
              })}
              <path d={path} className="weekly-report__line" />
              {trend.map((p, i) => {
                const x = px + i * step;
                const y = py + ch - (p.score / 100) * ch;
                return <circle key={`${p.dateLabel}-${i}`} cx={x} cy={y} r="4" className="weekly-report__dot" />;
              })}
            </svg>
          ) : (
            <p className="weekly-report__muted">Need at least two closed trades to render weekly trend.</p>
          )}
        </section>

        <section className="weekly-report__split">
          <article className="weekly-report__panel">
            <h3>System Observations</h3>
            <ul>
              {topInsights.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </article>
          <article className="weekly-report__panel">
            <h3>Pattern breakdown</h3>
            <ul className="weekly-report__patterns">
              {patternBreakdown.map((p) => (
                <li key={p.key}>
                  <span>{p.label}</span>
                  <strong>{p.count}</strong>
                </li>
              ))}
            </ul>
            <p className="weekly-report__muted">{patternInterpretation}</p>
          </article>
        </section>

        <section className="weekly-report__panel border-cyan-500/35 bg-cyan-500/5">
          <h3>Next Execution Plan</h3>
          <div className="mt-3 space-y-3">
            <div>
              <p className="weekly-report__k">System directive</p>
              <p className="mt-1 text-sm font-semibold text-slate-100">{actionPlan.directive}</p>
            </div>
            <div>
              <p className="weekly-report__k">Rules to follow</p>
              <ol className="mt-1">
                {actionPlan.rules.map((a) => (
                  <li key={a}>{a}</li>
                ))}
              </ol>
            </div>
            <div>
              <p className="weekly-report__k">Target outcome</p>
              <p className="mt-1 text-sm text-cyan-300">{actionPlan.targetOutcome}</p>
            </div>
          </div>
        </section>

        <section className="weekly-report__panel">
          <h3>System confidence</h3>
          <div className="mt-2 grid gap-3 md:grid-cols-3">
            <div>
              <p className="weekly-report__k">Confidence level</p>
              <p className="mt-1 text-sm font-semibold text-slate-100">
                {confidenceLevel === "HIGH"
                  ? "High confidence"
                  : confidenceLevel === "MEDIUM"
                    ? "Medium confidence"
                    : "Low confidence"}
              </p>
            </div>
            <div>
              <p className="weekly-report__k">Reason</p>
              <p className="mt-1 text-sm text-slate-300">{confidenceReason}</p>
            </div>
            <div>
              <p className="weekly-report__k">Action required</p>
              <p className="mt-1 text-sm text-slate-300">{confidenceAction}</p>
            </div>
          </div>
        </section>
      </div>
    </AppLayout>
  );
}

