import { useMemo } from "react";
import AppLayout from "../../layout/AppLayout/AppLayout.jsx";
import { useJournalPage } from "../../hooks/useJournalDecisions";
import {
  clampScore,
  inferPatternFromReportBlob,
  toneFromLog,
} from "../../domain/behavior/tradeBehaviorModel";

type PatternKey = "disciplined" | "revenge" | "early_exit" | "panic" | "holding_losers";
type TrendPoint = { idx: number; score: number; label: string };
type CapabilityId = "setup" | "execution" | "risk" | "behavior";

type EvolutionCard = {
  id: string;
  score: number;
  pattern: PatternKey;
  tone: "good" | "bad" | "warn";
  dateLabel: string;
};

type Capability = { id: CapabilityId; label: string; score: number; rationale: string };

function avg(nums: number[]): number {
  if (nums.length === 0) return 0;
  return nums.reduce((sum, n) => sum + n, 0) / nums.length;
}

function stdDev(nums: number[]): number {
  if (nums.length === 0) return 0;
  const mean = avg(nums);
  const variance = nums.reduce((s, n) => s + (n - mean) ** 2, 0) / nums.length;
  return Math.sqrt(variance);
}

function countWhere<T>(arr: T[], fn: (x: T) => boolean): number {
  let count = 0;
  for (const x of arr) if (fn(x)) count += 1;
  return count;
}

function ratio(count: number, total: number): number {
  if (total <= 0) return 0;
  return count / total;
}

function buildCards(logs: ReturnType<typeof useJournalPage>["logs"]): EvolutionCard[] {
  return logs.map((log) => {
    const tone = toneFromLog(log.decisionAction, log.confidence, log.archetype);
    const blob = `${log.centerPrimary} ${log.behavioralWhy} ${log.correctionBullets.join(" ")}`;
    return {
      id: log.id,
      score: clampScore(log.confidence),
      pattern: inferPatternFromReportBlob(blob, tone, log.archetype),
      tone,
      dateLabel: log.dateLabel,
    };
  });
}

function movingAverage(nums: number[], span: number): number[] {
  const out: number[] = [];
  for (let i = 0; i < nums.length; i += 1) {
    const start = Math.max(0, i - span + 1);
    const window = nums.slice(start, i + 1);
    out.push(avg(window));
  }
  return out;
}

function buildTrendPoints(cards: EvolutionCard[]): TrendPoint[] {
  const ordered = cards.slice(0, 30).reverse();
  const smoothed = movingAverage(
    ordered.map((c) => c.score),
    3,
  );
  return ordered.map((c, idx) => ({
    idx,
    score: clampScore(smoothed[idx] ?? c.score),
    label: c.dateLabel,
  }));
}

function trendDirection(points: TrendPoint[]): { arrow: "↑" | "↓" | "→"; delta: number } {
  if (points.length < 8) return { arrow: "→", delta: 0 };
  const first = points.slice(0, 5).map((p) => p.score);
  const last = points.slice(-5).map((p) => p.score);
  const delta = Math.round(avg(last) - avg(first));
  if (delta >= 4) return { arrow: "↑", delta };
  if (delta <= -4) return { arrow: "↓", delta };
  return { arrow: "→", delta };
}

function currentStreak(cards: EvolutionCard[], predicate: (c: EvolutionCard) => boolean): number {
  let run = 0;
  for (const card of cards) {
    if (!predicate(card)) break;
    run += 1;
  }
  return run;
}

function behaviorMeta(pattern: PatternKey): { impact: string; fix: string } {
  if (pattern === "revenge") {
    return {
      impact: "Escalates losses through emotional follow-through after a red trade.",
      fix: "Stop after 2 consecutive losses and restart only with full checklist.",
    };
  }
  if (pattern === "early_exit") {
    return {
      impact: "Trims expectancy by exiting before planned R-multiple is reached.",
      fix: "Define target ladder before entry and hold until first target is touched.",
    };
  }
  if (pattern === "holding_losers") {
    return {
      impact: "Expands downside and breaks portfolio risk budget.",
      fix: "Set hard stop at entry and disable add-size while position is below stop.",
    };
  }
  if (pattern === "panic") {
    return {
      impact: "Creates low-quality entries from urgency instead of setup confirmation.",
      fix: "Add a mandatory 60-second pause and re-check setup quality before execution.",
    };
  }
  return {
    impact: "Reinforces repeatable process and lowers outcome variance.",
    fix: "Keep the current pre-trade routine and journal the same setup template.",
  };
}

function patternLabel(k: PatternKey): string {
  if (k === "disciplined") return "Disciplined";
  if (k === "revenge") return "Revenge";
  if (k === "early_exit") return "Early Exit";
  if (k === "holding_losers") return "Holding Losers";
  return "Panic / FOMO";
}

function buildCapabilities(cards: EvolutionCard[]): Capability[] {
  if (cards.length === 0) {
    return [
      { id: "setup", label: "Setup Quality", score: 50, rationale: "Not enough recent trades yet." },
      { id: "execution", label: "Execution Discipline", score: 50, rationale: "Not enough recent trades yet." },
      { id: "risk", label: "Risk Management", score: 50, rationale: "Not enough recent trades yet." },
      { id: "behavior", label: "Behavior Control", score: 50, rationale: "Not enough recent trades yet." },
    ];
  }

  const n = cards.length;
  const goodRate = ratio(countWhere(cards, (c) => c.tone === "good"), n);
  const badRate = ratio(countWhere(cards, (c) => c.tone === "bad"), n);
  const impulsiveRate = ratio(
    countWhere(cards, (c) => c.pattern === "panic" || c.pattern === "revenge"),
    n,
  );
  const earlyExitRate = ratio(countWhere(cards, (c) => c.pattern === "early_exit"), n);
  const holdLoserRate = ratio(countWhere(cards, (c) => c.pattern === "holding_losers"), n);
  const disciplinedRate = ratio(countWhere(cards, (c) => c.pattern === "disciplined"), n);
  const confidence = avg(cards.map((c) => c.score));
  const volatility = Math.min(1, stdDev(cards.map((c) => c.score)) / 25);

  const setup = clampScore(confidence * 0.55 + (1 - impulsiveRate) * 45 - earlyExitRate * 12);
  const execution = clampScore(goodRate * 65 + (1 - badRate) * 35);
  const risk = clampScore((1 - holdLoserRate) * 50 + disciplinedRate * 30 + (1 - badRate) * 20);
  const behavior = clampScore((1 - impulsiveRate) * 70 + (1 - volatility) * 30);

  return [
    {
      id: "setup",
      label: "Setup Quality",
      score: setup,
      rationale: `${Math.round((1 - impulsiveRate) * 100)}% of recent trades avoid panic/revenge setup behavior.`,
    },
    {
      id: "execution",
      label: "Execution Discipline",
      score: execution,
      rationale: `${Math.round(goodRate * 100)}% recent trades are cleanly executed with high confidence.`,
    },
    {
      id: "risk",
      label: "Risk Management",
      score: risk,
      rationale: `${Math.round((1 - holdLoserRate) * 100)}% of trades avoid hold-loser drift.`,
    },
    {
      id: "behavior",
      label: "Behavior Control",
      score: behavior,
      rationale: `${Math.round((1 - volatility) * 100)}% emotional stability based on score volatility profile.`,
    },
  ];
}

export default function EvolutionProfilePage() {
  const journal = useJournalPage();
  const cards = useMemo(() => buildCards(journal.logs), [journal.logs]);
  const recentCards = useMemo(() => cards.slice(0, 30), [cards]);
  const trend = useMemo(() => buildTrendPoints(cards), [cards]);
  const direction = useMemo(() => trendDirection(trend), [trend]);

  const capabilities = useMemo(() => buildCapabilities(recentCards), [recentCards]);

  const overallScore = useMemo(() => {
    if (capabilities.length === 0) return 50;
    const setup = capabilities.find((c) => c.id === "setup")?.score ?? 50;
    const execution = capabilities.find((c) => c.id === "execution")?.score ?? 50;
    const risk = capabilities.find((c) => c.id === "risk")?.score ?? 50;
    const behavior = capabilities.find((c) => c.id === "behavior")?.score ?? 50;
    return clampScore(setup * 0.25 + execution * 0.25 + risk * 0.3 + behavior * 0.2);
  }, [capabilities]);

  const strength = useMemo(() => {
    return capabilities.slice().sort((a, b) => b.score - a.score)[0] ?? null;
  }, [capabilities]);

  const weakness = useMemo(() => {
    return capabilities.slice().sort((a, b) => a.score - b.score)[0] ?? null;
  }, [capabilities]);

  const consistencyScore = useMemo(() => {
    const vol = stdDev(recentCards.map((c) => c.score));
    return clampScore(100 - Math.round(vol * 2.8));
  }, [recentCards]);

  const currentCleanStreak = useMemo(() => currentStreak(recentCards, (c) => c.tone !== "bad"), [recentCards]);

  const relapseRisk = useMemo(() => {
    if (recentCards.length === 0) return 50;
    const badRate = ratio(countWhere(recentCards, (c) => c.tone === "bad"), recentCards.length);
    const volatilityFactor = Math.min(1, stdDev(recentCards.map((c) => c.score)) / 25);
    return clampScore(
      badRate * 55 + volatilityFactor * 25 + Math.min(20, currentStreak(recentCards, (c) => c.tone === "bad") * 7),
    );
  }, [recentCards]);

  const traderState = useMemo((): "Stable" | "Improving" | "Unstable" => {
    const badRate = ratio(countWhere(recentCards, (c) => c.tone === "bad"), Math.max(1, recentCards.length));
    if (overallScore < 45 || badRate > 0.55 || relapseRisk >= 70) return "Unstable";
    if (overallScore < 65 || direction.delta >= 4 || relapseRisk >= 45) return "Improving";
    return "Stable";
  }, [recentCards, overallScore, relapseRisk, direction.delta]);

  const qualityBuckets = useMemo(() => {
    const disciplined = countWhere(
      recentCards,
      (c) => c.tone === "good" && (c.pattern === "disciplined" || c.pattern === "early_exit"),
    );
    const lucky = countWhere(
      recentCards,
      (c) =>
        (c.tone === "warn" || c.pattern === "panic" || c.pattern === "revenge") &&
        c.tone !== "bad",
    );
    const poor = countWhere(recentCards, (c) => c.tone === "bad");
    return [
      {
        id: "disciplined",
        label: "Disciplined trades",
        count: disciplined,
        note: "Trades that followed process with controlled execution and acceptable confidence.",
      },
      {
        id: "lucky",
        label: "Lucky trades",
        count: lucky,
        note: "Positive outcomes where process quality was mixed, so repeatability is lower.",
      },
      {
        id: "poor",
        label: "Poor process trades",
        count: poor,
        note: "Trades driven by impulse, overhold, or low-confidence decisions.",
      },
    ];
  }, [recentCards]);

  const insightCards = useMemo(() => {
    const order: PatternKey[] = ["revenge", "panic", "holding_losers", "early_exit", "disciplined"];
    const rows = order
      .map((pattern) => {
        const count = countWhere(recentCards, (c) => c.pattern === pattern);
        const meta = behaviorMeta(pattern);
        return {
          pattern: patternLabel(pattern),
          count,
          impact: meta.impact,
          fix: meta.fix,
        };
      })
      .filter((x) => x.count > 0);
    return rows.length > 0 ? rows : [{ pattern: "No recurring issue", count: 0, impact: "No dominant drag pattern detected.", fix: "Keep following the current routine." }];
  }, [recentCards]);

  const systemRules = useMemo(() => {
    const rules: { title: string; reason: string }[] = [
      {
        title: journal.behavioral.systemAction.replace(/^MANDATORY:\s*/i, ""),
        reason: journal.behavioral.performanceImpact,
      },
      {
        title: journal.behavioral.triggerCondition,
        reason: "Rule trigger from the behavioral engine.",
      },
    ];
    if ((weakness?.id ?? "") === "risk") {
      rules.push({
        title: "Reduce line size to 75% until risk score improves above 65.",
        reason: "Risk Management is currently the weakest capability.",
      });
    }
    if (relapseRisk >= 60) {
      rules.push({
        title: "Enable cooldown after each poor-process trade.",
        reason: "Relapse risk is elevated in the recent window.",
      });
    }
    return rules.slice(0, 4);
  }, [journal.behavioral.systemAction, journal.behavioral.performanceImpact, journal.behavioral.triggerCondition, weakness?.id, relapseRisk]);

  const actionPlan = useMemo(() => {
    const plan: string[] = [];
    if (weakness?.id === "setup") {
      plan.push("Use a 3-check setup gate (context, trigger, invalidation) before every entry.");
    } else if (weakness?.id === "execution") {
      plan.push("Commit to scripted entries/exits for the next 10 trades with zero discretionary override.");
    } else if (weakness?.id === "risk") {
      plan.push("Pre-define stop and max risk per trade, then lock size before order placement.");
    } else if (weakness?.id === "behavior") {
      plan.push("Insert a mandatory pause after any emotional trigger before placing the next order.");
    }

    const secondary = capabilities
      .filter((c) => c.id !== weakness?.id)
      .sort((a, b) => a.score - b.score)[0];
    if (secondary?.id === "setup") {
      plan.push("Journal one sentence for setup quality before order submit to reduce rushed entries.");
    } else if (secondary?.id === "execution") {
      plan.push("Use a post-fill checklist to confirm execution matched original plan.");
    } else if (secondary?.id === "risk") {
      plan.push("Tag every stop breach in the journal and keep size static until two clean closes.");
    } else if (secondary?.id === "behavior") {
      plan.push("Track mood at entry and block trading when emotional state is elevated.");
    }

    plan.push("Review this profile every 20 trades and update only one process lever at a time.");
    return plan.slice(0, 3);
  }, [capabilities, weakness?.id]);

  const confidenceLevel = useMemo((): "LOW" | "MEDIUM" | "HIGH" => {
    if (recentCards.length >= 24) return "HIGH";
    if (recentCards.length >= 10) return "MEDIUM";
    return "LOW";
  }, [recentCards.length]);

  const confidenceReason = useMemo(() => {
    if (confidenceLevel === "HIGH") return `Sufficient sample (${recentCards.length} closed trades) for stable profile confidence.`;
    if (confidenceLevel === "MEDIUM") return `Partial sample (${recentCards.length} closes); confidence is building but still adaptive.`;
    return `Low sample (${recentCards.length} closes); profile confidence remains provisional.`;
  }, [confidenceLevel, recentCards.length]);

  const trendLabel = useMemo(() => {
    if (direction.delta >= 4) return `Improving (${direction.arrow}${direction.delta})`;
    if (direction.delta <= -4) return `Weakening (${direction.arrow}${direction.delta})`;
    return `Stabilizing (${direction.arrow}${direction.delta})`;
  }, [direction.arrow, direction.delta]);

  const trendInterpretation = useMemo(() => {
    if (trend.length < 8) return "Direction is preliminary. Additional closes are required for stable trend confidence.";
    if (direction.delta >= 4) return "Execution posture is stabilizing with improving behavior trajectory.";
    if (direction.delta <= -4) return "Execution quality is deteriorating and relapse risk is increasing.";
    return "Execution trajectory is flat; maintain controls and monitor for directional break.";
  }, [trend.length, direction.delta]);

  const systemPosition = useMemo(() => {
    if (traderState === "Unstable") return "Execution limited — restricted mode active until behavior stability recovers.";
    if (traderState === "Improving") return "Controlled — stabilizing mode; maintain constraints and avoid risk escalation.";
    if (confidenceLevel === "LOW") return "Controlled but low confidence — keep restrictions until sample quality improves.";
    return "Controlled — execution aligned with current profile constraints.";
  }, [traderState, confidenceLevel]);

  const capabilityInterpretation = useMemo(() => {
    if (!weakness) return "No limiting factor identified yet.";
    return `Limiting factor: ${weakness.label} (${weakness.score}). This subsystem currently sets the execution ceiling.`;
  }, [weakness]);

  const qualityInterpretation = useMemo(() => {
    const disciplined = qualityBuckets.find((b) => b.id === "disciplined")?.count ?? 0;
    const poor = qualityBuckets.find((b) => b.id === "poor")?.count ?? 0;
    if (disciplined >= poor) return "Execution quality is controlled with disciplined trades outpacing poor-process closes.";
    return "Execution quality is unstable; poor-process closes are reducing reliability.";
  }, [qualityBuckets]);

  const activePattern = insightCards[0] ?? null;

  const nextDirective = useMemo(() => {
    const directive =
      weakness?.id === "risk"
        ? "Reinforce risk discipline before allowing size escalation."
        : weakness?.id === "execution"
          ? "Standardize execution flow and remove discretionary overrides."
          : weakness?.id === "setup"
            ? "Tighten setup qualification to reduce low-edge entries."
            : weakness?.id === "behavior"
              ? "Stabilize behavioral control before adding risk complexity."
              : "Maintain controlled execution and incremental improvement.";
    const rules = actionPlan.slice(0, 2);
    const target =
      weakness != null
        ? `Raise ${weakness.label} above 65 while keeping relapse risk below 45.`
        : "Maintain score stability and avoid relapse acceleration.";
    const reviewCondition =
      confidenceLevel === "LOW"
        ? "Review after next 10 closed trades to refresh confidence."
        : "Review after next 20 closed trades or immediately if relapse risk exceeds 60.";
    return { directive, rules, target, reviewCondition };
  }, [weakness, actionPlan, confidenceLevel]);

  const stateTone = traderState.toLowerCase();

  const w = 900;
  const h = 210;
  const px = 20;
  const py = 14;
  const cw = w - px * 2;
  const ch = h - py * 2;
  const step = cw / Math.max(1, trend.length - 1);
  const path = trend.map((p, i) => `${i === 0 ? "M" : "L"} ${px + i * step} ${py + ch - (p.score / 100) * ch}`).join(" ");

  return (
    <AppLayout>
      <div className="home-terminal ti-profile">
        <header className="ti-profile__head">
          <h1>Trader Intelligence Profile</h1>
          <p>System-controlled trader state model for execution posture, constraints, and corrective direction.</p>
        </header>

        {journal.isLoading ? (
          <p className="page-loading page-note">Building trader intelligence profile…</p>
        ) : cards.length === 0 ? (
          <section className="ti-profile__section ti-profile__section--empty">
            <h2>Profile unavailable</h2>
            <p>Start logging trades to generate capability scores, trend evolution, and behavior intelligence.</p>
          </section>
        ) : (
          <>
            {(journal.isError || journal.isDegraded) && (
              <div className="data-degraded-banner" role="status">
                Some telemetry is degraded. Scores are estimated from available journal data.
              </div>
            )}

            <section
              className="ti-profile__section ti-profile__hero border-slate-700 bg-slate-900/70"
              aria-label="Trader state overview"
            >
              <div className="md:col-span-2">
                <p className="ti-profile__k">Trader state</p>
                <h2 className={`ti-profile__state ti-profile__state--${stateTone}`}>{traderState}</h2>
                <p className="mt-2 text-sm text-slate-300">{systemPosition}</p>
              </div>
              <div className="ti-profile__score rounded-lg border border-slate-800/80 bg-slate-950/40 p-3">
                <p className="ti-profile__k">Score</p>
                <strong>{overallScore}</strong>
              </div>
              <div className="ti-profile__score rounded-lg border border-slate-800/80 bg-slate-950/40 p-3">
                <p className="ti-profile__k">Confidence</p>
                <strong>{confidenceLevel}</strong>
              </div>
              <div className="ti-profile__score rounded-lg border border-slate-800/80 bg-slate-950/40 p-3">
                <p className="ti-profile__k">Trend</p>
                <strong className="text-lg">{trendLabel}</strong>
              </div>
              <div className="ti-profile__hero-notes md:col-span-2 rounded-lg border border-slate-800/80 bg-slate-950/30 p-3">
                <p><span>Primary strength</span><strong>{strength?.label ?? "—"}</strong></p>
                <p><span>Primary weakness</span><strong>{weakness?.label ?? "—"}</strong></p>
                <p><span>Confidence context</span><strong>{confidenceReason}</strong></p>
              </div>
            </section>

            <section className="ti-profile__section" aria-label="Core capabilities">
              <div className="ti-profile__section-head">
                <h2>Core Capabilities</h2>
                <p>Capability scores from recent process and behavior signals.</p>
              </div>
              <p className="ti-profile__muted">{capabilityInterpretation}</p>
              <div className="ti-profile__ability-grid">
                {capabilities.map((cap) => (
                  <article key={cap.id} className="ti-profile__ability-card">
                    <div className="ti-profile__ability-top">
                      <h3>{cap.label}</h3>
                      <strong>{cap.score}</strong>
                    </div>
                    <div className="ti-profile__bar">
                      <span style={{ width: `${cap.score}%` }} />
                    </div>
                    <p>{cap.rationale}</p>
                  </article>
                ))}
              </div>
            </section>

            <section className="ti-profile__section" aria-label="Evolution trend">
              <div className="ti-profile__section-head">
                <h2>Evolution</h2>
                <p>Last {trend.length} trades (smoothed) · Direction {trendLabel}</p>
              </div>
              <p className="ti-profile__muted">{trendInterpretation}</p>
              <p className="ti-profile__muted">
                Data sufficiency: {trend.length >= 12 ? "Sufficient" : "Limited"} ({trend.length} modeled closes)
              </p>
              {trend.length > 1 ? (
                <svg viewBox={`0 0 ${w} ${h}`} className="ti-profile__chart" role="img" aria-label="Trader evolution trend">
                  {[25, 50, 75].map((s) => {
                    const y = py + ch - (s / 100) * ch;
                    return <line key={s} x1={px} x2={px + cw} y1={y} y2={y} className="ti-profile__grid" />;
                  })}
                  <path d={path} className="ti-profile__line" />
                </svg>
              ) : (
                <p className="ti-profile__muted">Need more closed trades to show a meaningful trend.</p>
              )}
            </section>

            <section className="ti-profile__section" aria-label="Trade quality classification">
              <div className="ti-profile__section-head">
                <h2>Trade Quality</h2>
                <p>Classification of recent trade process quality.</p>
              </div>
              <p className="ti-profile__muted">{qualityInterpretation}</p>
              <div className="ti-profile__quality-grid">
                {qualityBuckets.map((bucket) => (
                  <article key={bucket.id} className="ti-profile__quality-card">
                    <h3>{bucket.label}</h3>
                    <strong>{bucket.count}</strong>
                    <p>{bucket.note}</p>
                  </article>
                ))}
              </div>
            </section>

            <section className="ti-profile__section" aria-label="Active behavior pattern">
              <div className="ti-profile__section-head">
                <h2>Active Behavior Pattern</h2>
                <p>Dominant pattern, its impact, and current system response.</p>
              </div>
              {activePattern ? (
                <article className="ti-profile__insight-card">
                  <p className="ti-profile__insight-row"><span>Pattern</span><strong>{activePattern.pattern}</strong></p>
                  <p className="ti-profile__insight-row"><span>Impact</span><strong>{activePattern.impact}</strong></p>
                  <p className="ti-profile__insight-copy ti-profile__insight-copy--fix">
                    <strong>System response:</strong> {activePattern.fix}
                  </p>
                </article>
              ) : (
                <p className="ti-profile__muted">No active pattern promoted in this window.</p>
              )}
            </section>

            <section className="ti-profile__section" aria-label="Active system constraints">
              <div className="ti-profile__section-head">
                <h2>Active System Constraints</h2>
                <p>Enforced controls currently restricting execution behavior.</p>
              </div>
              <ul className="ti-profile__rules">
                {systemRules.map((rule) => (
                  <li key={`${rule.title}-${rule.reason}`}>
                    <p>ENFORCED: {rule.title}</p>
                    <small>{rule.reason}</small>
                  </li>
                ))}
              </ul>
            </section>

            <section className="ti-profile__section" aria-label="Consistency and relapse risk">
              <div className="ti-profile__section-head">
                <h2>Consistency</h2>
                <p>Stability of execution quality across the latest trade window.</p>
              </div>
              <div className="ti-profile__consistency">
                <article>
                  <p>Consistency score</p>
                  <strong>{consistencyScore}</strong>
                </article>
                <article>
                  <p>Current streak</p>
                  <strong>{currentCleanStreak}</strong>
                </article>
                <article>
                  <p>Relapse risk</p>
                  <strong>{relapseRisk}</strong>
                </article>
              </div>
              <p className="ti-profile__muted">
                Stability-to-relapse link: {traderState === "Unstable"
                  ? "unstable state increases short-cycle relapse probability."
                  : traderState === "Improving"
                    ? "improving state lowers relapse risk only if constraints remain enforced."
                    : "stable state remains controlled while relapse risk stays below threshold."}
              </p>
            </section>

            <section className="ti-profile__section border-cyan-500/35 bg-cyan-500/5" aria-label="Next improvement directive">
              <div className="ti-profile__section-head">
                <h2>Next Improvement Directive</h2>
                <p>System-mandated next steps tied to current state and relapse risk.</p>
              </div>
              <div className="space-y-3 text-sm">
                <p><span className="ti-profile__k">System directive</span><br />{nextDirective.directive}</p>
                <div>
                  <p className="ti-profile__k">Rules</p>
                  <ul className="ti-profile__actions">
                    {nextDirective.rules.map((step) => (
                      <li key={step}>{step}</li>
                    ))}
                  </ul>
                </div>
                <p><span className="ti-profile__k">Target</span><br />{nextDirective.target}</p>
                <p><span className="ti-profile__k">Review condition</span><br />{nextDirective.reviewCondition}</p>
              </div>
            </section>
          </>
        )}
      </div>
    </AppLayout>
  );
}

