import { useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import AppLayout from "../../layout/AppLayout/AppLayout.jsx";
import { useJournalPage } from "../../hooks/useJournalDecisions";
import { ROUTES } from "../../routing/routes";
import { buildJournalPageViewModel } from "./buildJournalPageViewModel";
import {
  clampScore,
  inferPatternFromJournalBlob,
  toneFromLog,
} from "../../domain/behavior/tradeBehaviorModel";

type BehaviorMarker = "PANIC_EXIT" | "FOMO_ENTRY" | "DISCIPLINED" | "EARLY_EXIT" | "REVENGE" | "HOLDING_LOSERS";
type TrendPoint = {
  idx: number;
  score: number;
  tone: "good" | "bad" | "warn";
  cardId: string;
  dateLabel: string;
  marker: BehaviorMarker;
  impactScore: number;
  causedShift: boolean;
  symbol: string;
};
type TradeFilter = "all" | "good" | "bad";
type RangeFilter = "all" | "30d" | "90d";
type PatternKey = "all" | "disciplined" | "revenge" | "early_exit" | "panic" | "holding_losers";
type StateConfidence = "LOW" | "MEDIUM" | "HIGH";

type TradeCardVm = {
  id: string;
  symbol: string;
  dateLabel: string;
  resultPctLabel: string;
  resultPositive: boolean;
  behaviorTag: string;
  pattern: Exclude<PatternKey, "all">;
  setupScore: number;
  marketScore: number;
  behaviorScore: number;
  entrySummary: string;
  exitSummary: string;
  verdict: string;
  lesson: string;
  tone: "good" | "bad" | "warn";
  timestamp: number | null;
  marker: BehaviorMarker;
  impactScore: number;
  impactNarrative: string;
  causedShift: boolean;
};

type HeatCell = { key: string; score: number | null; dateLabel: string };
type RecoveryModel = {
  active: boolean;
  durationTrades: number;
  causeLine: string;
  stateLabel: string;
  constraints: string[];
  goalLabel: string;
  progressPct: number;
  progressLabel: string;
  insight: string;
};

const PATTERN_LABELS: Record<Exclude<PatternKey, "all">, string> = {
  disciplined: "Disciplined",
  revenge: "Revenge",
  early_exit: "Early Exit",
  panic: "Panic",
  holding_losers: "Holding losers",
};

function parseDateLabel(label: string): number | null {
  const t = Date.parse(label);
  return Number.isFinite(t) ? t : null;
}

function barText(score: number): string {
  const seg = 10;
  const n = Math.round((score / 100) * seg);
  return `${"█".repeat(n)}${"░".repeat(seg - n)}`;
}

function behaviorStatusLabel(
  state: string,
  trend: "improving" | "declining" | "flat" | "insufficient",
): "Stable" | "Unstable" | "Improving" {
  if (trend === "improving") return "Improving";
  if (state === "UNSTABLE" || trend === "declining") return "Unstable";
  return "Stable";
}

function behaviorStatusInterpretation(
  label: "Stable" | "Unstable" | "Improving",
  riskLevel: string,
  tradeCount: number,
): string {
  if (tradeCount === 0) return "No closed-trade evidence yet. System readiness is neutral until behavior data forms.";
  if (label === "Unstable") return "Deviation detected in recent execution behavior with elevated discipline risk.";
  if (label === "Improving") return "Execution alignment is improving versus the prior window.";
  if (riskLevel === "HIGH") return "Behavior currently controlled but risk remains elevated.";
  return "Execution aligned and behavior variance remains within controlled range.";
}

function behaviorSystemGuidance(
  label: "Stable" | "Unstable" | "Improving",
  dominantDriver: string,
): string {
  if (label === "Unstable") {
    return `Reduce discretion and enforce checklist compliance on every trade. Prioritize fixing ${dominantDriver}.`;
  }
  if (label === "Improving") {
    return "Maintain current process for the next five trades and avoid manual overrides outside pre-defined exits.";
  }
  return "Keep risk process unchanged and continue disciplined execution cadence.";
}

function tradeBehaviorLabel(pattern: Exclude<PatternKey, "all">): string {
  if (pattern === "disciplined") return "Disciplined";
  if (pattern === "panic") return "Panic";
  if (pattern === "revenge") return "Revenge";
  if (pattern === "early_exit") return "Premature Exit";
  return "Holding Losers";
}

function tradeSystemJudgment(
  tone: "good" | "bad" | "warn",
  verdict: string,
): "Execution aligned" | "Deviation detected" | "Controlled" | "Unstable" {
  const v = verdict.toUpperCase();
  if (tone === "bad" || v === "BLOCK") return "Deviation detected";
  if (tone === "warn" || v === "GUIDE") return "Unstable";
  if (tone === "good" && v === "ACT") return "Execution aligned";
  return "Controlled";
}

function markerFromTrade(blob: string, pattern: Exclude<PatternKey, "all">): BehaviorMarker {
  if (/fomo|chase|late entry/i.test(blob)) return "FOMO_ENTRY";
  if (pattern === "panic") return "PANIC_EXIT";
  if (pattern === "disciplined") return "DISCIPLINED";
  if (pattern === "early_exit") return "EARLY_EXIT";
  if (pattern === "revenge") return "REVENGE";
  return "HOLDING_LOSERS";
}

function impactNarrative(marker: BehaviorMarker, impact: number): string {
  if (impact >= 0) {
    if (marker === "DISCIPLINED") return "reinforced disciplined execution";
    return "improved protocol adherence";
  }
  if (marker === "PANIC_EXIT") return "triggered panic exit pattern";
  if (marker === "FOMO_ENTRY") return "triggered FOMO entry pressure";
  if (marker === "EARLY_EXIT") return "repeated early exit behavior";
  if (marker === "REVENGE") return "triggered revenge behavior";
  return "reinforced holding-loser behavior";
}

function toTrendPoints(cards: TradeCardVm[], take: number): TrendPoint[] {
  const points = cards.slice(0, take).reverse();
  return points.map((c, idx) => ({
    idx,
    score: c.behaviorScore,
    tone: c.tone,
    cardId: c.id,
    dateLabel: c.dateLabel,
    marker: c.marker,
    impactScore: c.impactScore,
    causedShift: c.causedShift,
    symbol: c.symbol,
  }));
}

function stateConfidenceByTrades(tradeCount: number): StateConfidence {
  if (tradeCount >= 16) return "HIGH";
  if (tradeCount >= 6) return "MEDIUM";
  return "LOW";
}

function stateEvidence(cards: TradeCardVm[]): string[] {
  const recent = cards.slice(0, 12);
  if (recent.length === 0) return ["No closed trades yet"];

  const panicExits = recent.filter((c) => c.pattern === "panic").length;
  const disciplinedTrades = recent.filter((c) => c.pattern === "disciplined").length;
  const earlyExits = recent.filter((c) => c.pattern === "early_exit").length;
  const revengeTrades = recent.filter((c) => c.pattern === "revenge").length;
  const holdingLosers = recent.filter((c) => c.pattern === "holding_losers").length;

  const lines: string[] = [];
  if (panicExits > 0) lines.push(`${panicExits} panic exit${panicExits === 1 ? "" : "s"}`);
  if (disciplinedTrades > 0) lines.push(`${disciplinedTrades} disciplined trade${disciplinedTrades === 1 ? "" : "s"}`);
  if (earlyExits > 0) lines.push(`${earlyExits} early exit${earlyExits === 1 ? "" : "s"}`);
  if (revengeTrades > 0) lines.push(`${revengeTrades} revenge pattern${revengeTrades === 1 ? "" : "s"}`);
  if (holdingLosers > 0) lines.push(`${holdingLosers} holding-loser pattern${holdingLosers === 1 ? "" : "s"}`);
  if (lines.length === 0) lines.push("No repeat behavior pattern detected yet");

  return lines.slice(0, 3);
}

function disciplineDelta(cards: TradeCardVm[]): { delta: number | null; trend: "improving" | "declining" | "flat" | "insufficient" } {
  if (cards.length < 4) return { delta: null, trend: "insufficient" };

  const windowSize = Math.min(6, Math.floor(cards.length / 2));
  if (windowSize < 2) return { delta: null, trend: "insufficient" };

  const recent = cards.slice(0, windowSize);
  const previous = cards.slice(windowSize, windowSize * 2);
  if (previous.length < windowSize) return { delta: null, trend: "insufficient" };

  const recentAvg = recent.reduce((sum, card) => sum + card.behaviorScore, 0) / recent.length;
  const previousAvg = previous.reduce((sum, card) => sum + card.behaviorScore, 0) / previous.length;
  const delta = Math.round(recentAvg - previousAvg);

  if (Math.abs(delta) < 2) return { delta, trend: "flat" };
  return { delta, trend: delta > 0 ? "improving" : "declining" };
}

function directionGlyph(t: "improving" | "declining" | "flat" | "insufficient"): "↑" | "↓" | "→" {
  if (t === "improving") return "↑";
  if (t === "declining") return "↓";
  return "→";
}

function topDrivers(cards: TradeCardVm[]): string[] {
  const recent = cards.slice(0, 10);
  const badPatterns = recent.filter((c) => c.pattern !== "disciplined");
  if (badPatterns.length === 0) return ["Disciplined execution", "Risk exits respected"];
  const tally = new Map<string, number>();
  for (const c of badPatterns) {
    tally.set(c.behaviorTag, (tally.get(c.behaviorTag) ?? 0) + 1);
  }
  return [...tally.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 2)
    .map(([name]) => name.toLowerCase());
}

function slopeMeta(points: TrendPoint[]): { trend: "up" | "down" | "flat"; delta: number; text: string } {
  if (points.length < 4) return { trend: "flat", delta: 0, text: "Insufficient points for slope" };
  const first = points[0]?.score ?? 0;
  const last = points[points.length - 1]?.score ?? 0;
  const delta = Math.round(last - first);
  if (Math.abs(delta) < 3) return { trend: "flat", delta, text: "Flat slope across selected window" };
  if (delta > 0) return { trend: "up", delta, text: `Improving slope (+${delta})` };
  return { trend: "down", delta, text: `Declining slope (${delta})` };
}

function buildRecoveryModel(cards: TradeCardVm[], trend: "improving" | "declining" | "flat" | "insufficient"): RecoveryModel {
  if (cards.length === 0) {
    return {
      active: false,
      durationTrades: 0,
      causeLine: "No recovery condition",
      stateLabel: "NORMAL",
      constraints: [],
      goalLabel: "No active recovery goal",
      progressPct: 0,
      progressLabel: "N/A",
      insight: "Add closed trades to activate behavior intelligence.",
    };
  }

  const recent = cards.slice(0, 10);
  const bad = recent.filter((c) => c.tone === "bad").length;
  const panic = recent.filter((c) => c.marker === "PANIC_EXIT").length;
  const revenge = recent.filter((c) => c.marker === "REVENGE").length;
  const earlyExit = recent.filter((c) => c.marker === "EARLY_EXIT").length;
  const declining = trend === "declining";
  const repeatedNegative = bad >= 4 || panic >= 2 || revenge >= 2 || earlyExit >= 3;
  const active = declining && repeatedNegative;
  if (!active) {
    return {
      active: false,
      durationTrades: 0,
      causeLine: "No active recovery trigger",
      stateLabel: "NORMAL",
      constraints: [],
      goalLabel: "No active recovery goal",
      progressPct: 0,
      progressLabel: "N/A",
      insight: "Behavior trend is not in a recovery-triggered state.",
    };
  }

  let durationTrades = 0;
  for (const c of cards) {
    if (c.tone === "bad" || c.impactScore <= -4) durationTrades += 1;
    else break;
  }

  const causes: string[] = [];
  if (panic >= 2) causes.push("panic exits");
  if (earlyExit >= 3) causes.push("early exits");
  if (revenge >= 2) causes.push("revenge entries");
  if (causes.length === 0) causes.push("negative behavior clustering");

  const constraints: string[] = [];
  constraints.push("Position scaling locked to 1 unit until recovery goal is met.");
  constraints.push("Thesis required before every trade (minimum 40 characters).");
  if (panic >= 2) constraints.push("Hold each next trade for at least 10 minutes before discretionary exit.");
  if (revenge >= 1) constraints.push("Cooldown required after a loss before re-entry.");
  if (earlyExit >= 2) constraints.push("Exit only at predefined stop/target for next 3 closes.");

  const targetWindow = cards.slice(0, 5);
  const compliant = targetWindow.filter((c) => c.tone !== "bad" && c.impactScore >= -1).length;
  const progressPct = Math.round((compliant / Math.max(1, targetWindow.length)) * 100);

  return {
    active: true,
    durationTrades,
    causeLine: causes.slice(0, 2).join(", "),
    stateLabel: "RECOVERY MODE",
    constraints: constraints.slice(0, 4),
    goalLabel: "Target: 4 of next 5 trades with non-negative behavior impact",
    progressPct,
    progressLabel: `${compliant}/${Math.max(1, targetWindow.length)} compliant trades`,
    insight: "Recovery mode reduces behavior volatility by enforcing process consistency before risk escalation.",
  };
}

function summarizeCurrentState(cards: TradeCardVm[]): {
  state: string;
  disciplineScore: number;
  riskLevel: string;
  sparkline: TrendPoint[];
  confidence: StateConfidence;
  confidenceSummary: string;
  evidence: string[];
} {
  if (cards.length === 0) {
    return {
      state: "INACTIVE",
      disciplineScore: 0,
      riskLevel: "N/A",
      sparkline: [],
      confidence: "LOW",
      confidenceSummary: "Low confidence - 0 trades only",
      evidence: ["No behavioral evidence yet"],
    };
  }
  const recent = cards.slice(0, 12);
  const avg = Math.round(recent.reduce((s, c) => s + c.behaviorScore, 0) / recent.length);
  const badRatio = recent.filter((c) => c.tone === "bad").length / recent.length;
  const state = avg >= 72 && badRatio <= 0.33 ? "DISCIPLINED" : avg >= 58 ? "TRANSITIONAL" : "UNSTABLE";
  const riskLevel = badRatio >= 0.5 || avg < 55 ? "HIGH" : badRatio >= 0.3 || avg < 68 ? "MEDIUM" : "LOW";
  const confidence = stateConfidenceByTrades(cards.length);
  const confidenceSummary =
    confidence === "LOW"
      ? `Low confidence - ${cards.length} trade${cards.length === 1 ? "" : "s"} only`
      : confidence === "MEDIUM"
        ? `Medium confidence - building from ${cards.length} trades`
        : `High confidence - ${cards.length} trades in sample`;

  return {
    state,
    disciplineScore: avg,
    riskLevel,
    sparkline: toTrendPoints(cards, 18),
    confidence,
    confidenceSummary,
    evidence: stateEvidence(cards),
  };
}

function buildTradeCards(journal: ReturnType<typeof useJournalPage>): TradeCardVm[] {
  const base = journal.logs.map((log) => {
    const tone = toneFromLog(log.decisionAction, log.confidence, log.archetype);
    const blob = `${log.centerPrimary} ${log.behavioralWhy} ${log.correctionBullets.join(" ")}`;
    const pattern = inferPatternFromJournalBlob(blob, tone, log.archetype);
    const marker = markerFromTrade(blob, pattern);
    const behaviorScore = clampScore(log.confidence);
    const setupScore = clampScore(
      behaviorScore +
        (log.decisionAction === "ACT" ? 8 : -6) +
        (log.archetype === "STOPPED_OUT" ? 6 : 0) +
        (log.archetype === "IMPULSIVE" ? -10 : 0),
    );
    const marketScore = clampScore(
      behaviorScore + (log.behaviorTags.includes("systematic") ? 6 : -4) + (log.decisionAction === "BLOCK" ? -10 : 0),
    );
    const proxyResult = Number((((behaviorScore - 50) / 2.2) * (tone === "good" ? 1 : tone === "bad" ? -1 : 0.35)).toFixed(1));
    const exitSummary =
      log.archetype === "STOPPED_OUT"
        ? "Exit followed planned risk parameters."
        : log.archetype === "OVERHOLD"
          ? "Exit delayed beyond initial plan."
          : log.archetype === "IMPULSIVE"
            ? "Exit influenced by reactive pressure."
            : "Exit reviewed and journaled.";
    const lesson =
      log.correctionBullets[0] ??
      "Write a corrective step before the next trade.";

    return {
      id: log.id,
      symbol: log.symbol,
      dateLabel: log.dateLabel,
      resultPctLabel: `${proxyResult >= 0 ? "+" : ""}${proxyResult}%`,
      resultPositive: proxyResult >= 0,
      behaviorTag: PATTERN_LABELS[pattern].toUpperCase(),
      pattern,
      setupScore,
      marketScore,
      behaviorScore,
      entrySummary: log.centerPrimary,
      exitSummary,
      verdict: log.decisionAction,
      lesson,
      tone,
      timestamp: parseDateLabel(log.dateLabel),
      marker,
      impactScore: 0,
      impactNarrative: "Baseline row",
      causedShift: false,
    };
  });

  return base.map((card, idx, arr) => {
    const older = arr[idx + 1];
    const newer = arr[idx - 1];
    const impact = older ? card.behaviorScore - older.behaviorScore : 0;
    const previousImpact = newer ? newer.behaviorScore - card.behaviorScore : null;
    const causedShift =
      previousImpact != null &&
      Math.sign(previousImpact) !== Math.sign(impact) &&
      Math.abs(impact) >= 6 &&
      Math.abs(previousImpact) >= 4;
    return {
      ...card,
      impactScore: impact,
      impactNarrative: impactNarrative(card.marker, impact),
      causedShift,
    };
  });
}

function filterTrades(cards: TradeCardVm[], mode: TradeFilter, pattern: PatternKey, range: RangeFilter): TradeCardVm[] {
  const now = Date.now();
  const rangeMs = range === "30d" ? 30 * 24 * 60 * 60 * 1000 : range === "90d" ? 90 * 24 * 60 * 60 * 1000 : null;
  return cards.filter((c) => {
    if (mode === "good" && c.tone !== "good") return false;
    if (mode === "bad" && c.tone === "good") return false;
    if (pattern !== "all" && c.pattern !== pattern) return false;
    if (rangeMs != null && c.timestamp != null && now - c.timestamp > rangeMs) return false;
    return true;
  });
}

function buildHeatCells(cards: TradeCardVm[], maxDays = 56): HeatCell[] {
  const byDay = new Map<string, { score: number; count: number }>();
  for (const c of cards) {
    if (c.timestamp == null) continue;
    const day = new Date(c.timestamp);
    const key = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, "0")}-${String(day.getDate()).padStart(2, "0")}`;
    const prev = byDay.get(key) ?? { score: 0, count: 0 };
    byDay.set(key, { score: prev.score + c.behaviorScore, count: prev.count + 1 });
  }

  const out: HeatCell[] = [];
  for (let i = maxDays - 1; i >= 0; i -= 1) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const item = byDay.get(key);
    out.push({
      key,
      score: item ? Math.round(item.score / item.count) : null,
      dateLabel: d.toLocaleDateString("en-IN", { day: "2-digit", month: "short" }),
    });
  }
  return out;
}

function Sparkline({ points }: { points: TrendPoint[] }) {
  if (points.length < 2) {
    return <p className="journal-dash__muted">Waiting for enough closed trades to render trend.</p>;
  }
  const w = 360;
  const h = 72;
  const xStep = w / Math.max(1, points.length - 1);
  const poly = points.map((p, i) => `${i * xStep},${h - (p.score / 100) * h}`).join(" ");
  return (
    <svg className="journal-dash__sparkline" viewBox={`0 0 ${w} ${h}`} role="img" aria-label="Behavior sparkline">
      <polyline className="journal-dash__sparkline-line" fill="none" points={poly} />
    </svg>
  );
}

function BehaviorChart({
  points,
  showTrendLine,
  highlightedCardId,
  onHighlightCard,
  onPointClick,
  onHoverPoint,
}: {
  points: TrendPoint[];
  showTrendLine: boolean;
  highlightedCardId: string | null;
  onHighlightCard: (cardId: string | null) => void;
  onPointClick: (cardId: string) => void;
  onHoverPoint: (point: TrendPoint | null) => void;
}) {
  if (points.length === 0) {
    return <p className="journal-dash__muted">Trend chart activates once closed trades are available for this filter.</p>;
  }
  const w = 780;
  const h = 220;
  const padX = 22;
  const padY = 16;
  const chartW = w - padX * 2;
  const chartH = h - padY * 2;
  const xStep = chartW / Math.max(1, points.length - 1);
  const path = showTrendLine
    ? points.map((p, i) => `${i === 0 ? "M" : "L"} ${padX + i * xStep} ${padY + chartH - (p.score / 100) * chartH}`).join(" ")
    : "";
  return (
    <svg className="journal-dash__chart-svg" viewBox={`0 0 ${w} ${h}`} role="img" aria-label="Behavior trend chart">
      <rect
        x={padX}
        y={padY}
        width={chartW}
        height={chartH * 0.33}
        className="journal-dash__chart-zone journal-dash__chart-zone--good"
      />
      <rect
        x={padX}
        y={padY + chartH * 0.66}
        width={chartW}
        height={chartH * 0.34}
        className="journal-dash__chart-zone journal-dash__chart-zone--bad"
      />
      {[20, 40, 60, 80].map((s) => {
        const y = padY + chartH - (s / 100) * chartH;
        return <line key={s} x1={padX} x2={padX + chartW} y1={y} y2={y} className="journal-dash__chart-grid" />;
      })}
      {showTrendLine ? <path className="journal-dash__chart-line" d={path} /> : null}
      {points.map((p, i) => {
        const x = padX + i * xStep;
        const y = padY + chartH - (p.score / 100) * chartH;
        const isHighlighted = highlightedCardId === p.cardId;
        return (
          <circle
            key={`${p.idx}-${p.score}`}
            cx={x}
            cy={y}
            r={isHighlighted ? "6.5" : "4.5"}
            className={
              p.tone === "good"
                ? `journal-dash__chart-point journal-dash__chart-point--good journal-dash__chart-point--marker-${p.marker.toLowerCase()}${isHighlighted ? " is-highlighted" : ""}`
                : p.tone === "bad"
                  ? `journal-dash__chart-point journal-dash__chart-point--bad journal-dash__chart-point--marker-${p.marker.toLowerCase()}${isHighlighted ? " is-highlighted" : ""}`
                  : `journal-dash__chart-point journal-dash__chart-point--warn journal-dash__chart-point--marker-${p.marker.toLowerCase()}${isHighlighted ? " is-highlighted" : ""}`
            }
            onMouseEnter={() => {
              onHighlightCard(p.cardId);
              onHoverPoint(p);
            }}
            onMouseLeave={() => {
              onHighlightCard(null);
              onHoverPoint(null);
            }}
            onClick={() => onPointClick(p.cardId)}
            title={`${p.symbol} ${p.dateLabel} ${p.marker}`}
            style={{ cursor: "pointer" }}
          />
        );
      })}
    </svg>
  );
}

export default function JournalPage() {
  const journal = useJournalPage();
  const vm = useMemo(() => buildJournalPageViewModel(journal), [journal]);
  const [tradeFilter, setTradeFilter] = useState<TradeFilter>("all");
  const [patternFilter, setPatternFilter] = useState<PatternKey>("all");
  const [rangeFilter, setRangeFilter] = useState<RangeFilter>("all");
  const [highlightedCardId, setHighlightedCardId] = useState<string | null>(null);
  const [hoveredPoint, setHoveredPoint] = useState<TrendPoint | null>(null);
  const tradeCardRefs = useRef<Record<string, HTMLElement | null>>({});
  const chartSectionRef = useRef<HTMLElement | null>(null);

  const cards = useMemo(() => buildTradeCards(journal), [journal]);
  const stateDelta = useMemo(() => disciplineDelta(cards), [cards]);
  const state = useMemo(() => summarizeCurrentState(cards), [cards]);
  const filteredCards = useMemo(
    () => filterTrades(cards, tradeFilter, patternFilter, rangeFilter),
    [cards, patternFilter, rangeFilter, tradeFilter],
  );
  const points = useMemo(() => toTrendPoints(filteredCards, 24), [filteredCards]);
  const heatCells = useMemo(() => buildHeatCells(cards), [cards]);
  const isEarlyStageChart = points.length > 0 && points.length < 10;
  const slope = useMemo(() => slopeMeta(points), [points]);
  const drivers = useMemo(() => topDrivers(cards), [cards]);
  const recovery = useMemo(() => buildRecoveryModel(cards, stateDelta.trend), [cards, stateDelta.trend]);

  const patternStats = useMemo(() => {
    const current = cards.slice(0, 10);
    const previous = cards.slice(10, 20);
    const entries = Object.entries(PATTERN_LABELS).map(([k, label]) => {
      const key = k as Exclude<PatternKey, "all">;
      const count = current.filter((c) => c.pattern === key).length;
      const prevCount = previous.filter((c) => c.pattern === key).length;
      const pct = current.length > 0 ? Math.round((count / current.length) * 100) : 0;
      return { key, label, count, pct, delta: count - prevCount };
    });
    return entries.sort((a, b) => b.count - a.count);
  }, [cards]);

  const dominantPattern = patternStats[0] ?? null;
  const recentWindow = useMemo(() => cards.slice(0, 10), [cards]);
  const disciplinedCount = useMemo(
    () => recentWindow.filter((c) => c.pattern === "disciplined").length,
    [recentWindow],
  );
  const deviationCount = Math.max(0, recentWindow.length - disciplinedCount);
  const behaviorStatus = behaviorStatusLabel(state.state, stateDelta.trend);
  const behaviorInterpretation = behaviorStatusInterpretation(behaviorStatus, state.riskLevel, vm.entryCount);
  const behaviorGuidance = behaviorSystemGuidance(behaviorStatus, drivers[0] ?? "dominant deviation pattern");
  const timelineInterpretation =
    recentWindow.length === 0
      ? "Insufficient evidence in the latest window."
      : disciplinedCount >= deviationCount
        ? "Execution aligned in the recent window, with controlled deviations."
        : "Deviation detected in the recent window. Tighten protocol before adding risk.";
  const dominantPatternInterpretation =
    dominantPattern == null
      ? "No dominant pattern yet. Continue logging to establish system confidence."
      : dominantPattern.key === "disciplined"
        ? "Execution aligned pattern is dominant. Preserve current process discipline."
        : dominantPattern.delta > 0
          ? "Deviation pattern frequency is rising versus the previous window."
          : dominantPattern.delta < 0
            ? "Deviation pattern frequency is reducing versus the previous window."
            : "Pattern frequency is unchanged versus the previous window.";
  const heatmapInsight =
    vm.entryCount < 10
      ? "Data sufficiency is low; trend reliability increases after 10+ closed trades."
      : slope.trend === "up"
        ? "Heatmap trend indicates improving execution consistency."
        : slope.trend === "down"
          ? "Heatmap trend indicates rising deviation pressure."
          : "Heatmap trend is neutral; monitor next trades for directional break.";

  const guidance = useMemo(() => {
    const lines = [...vm.patternLines, ...vm.systemResponseLines]
      .map((x) =>
        x
          .replace(/^Rule:\s*/i, "")
          .replace(/^MANDATORY:\s*/i, "")
          .replace(/^Constraint:\s*/i, "")
          .trim(),
      )
      .filter(Boolean);
    const first = lines[0] ?? "Behavior is mixed with no dominant pattern lock yet.";
    const second = lines[1] ?? "System currently requires protocol acknowledgment on drifted entries.";
    const actionLine =
      dominantPattern && dominantPattern.key !== "disciplined"
        ? dominantPattern.key === "panic"
          ? "Hold each of the next 3 trades for at least 10 minutes before discretionary exit."
          : dominantPattern.key === "early_exit"
            ? "Pre-commit target exits for the next 3 trades and avoid manual profit cutting."
            : dominantPattern.key === "revenge"
              ? "After a loss, enforce a cooldown and only trade when checklist is fully green."
              : "Define stop/target before entry for the next 3 trades and avoid adding against plan."
        : "Repeat current process cadence for the next 3 trades to lock in discipline.";

    return [
      {
        observation: first,
        implication:
          dominantPattern != null
            ? `${dominantPattern.label} is dominant (${dominantPattern.count}/10 recent trades).`
            : "Pattern dominance not established yet.",
        action: actionLine,
      },
      {
        observation: second,
        implication:
          stateDelta.delta == null
            ? "Trend direction still forming."
            : `Discipline moved ${stateDelta.delta > 0 ? "+" : ""}${stateDelta.delta} versus previous window.`,
        action:
          stateDelta.trend === "declining"
            ? "Reduce size and use strict stop/target compliance until trend stabilizes."
            : stateDelta.trend === "improving"
              ? "Maintain current protocol and avoid impulsive overrides for the next 5 trades."
              : "Keep process unchanged and monitor if next 3 trades break this range.",
      },
    ];
  }, [vm.patternLines, vm.systemResponseLines, dominantPattern, stateDelta.delta, stateDelta.trend]);

  return (
    <AppLayout>
      <div className="home-terminal journal-learn">
        <header className="journal-learn__head">
          <h1 className="journal-learn__title">Journal</h1>
          <p className="journal-learn__subtitle">System-controlled feedback loop for trader discipline</p>
        </header>

        {vm.isDegraded && (
          <div className="data-degraded-banner journal-learn__banner" role="status">
            Partial window — live journal sync degraded; entries shown may be incomplete.
          </div>
        )}

        {recovery.active ? (
          <section className="journal-recovery" aria-label="Behavior recovery mode">
            <header className="journal-recovery__banner">
              <p className="journal-recovery__state">
                {recovery.stateLabel} · {directionGlyph(stateDelta.trend)} {stateDelta.delta == null ? "N/A" : stateDelta.delta}
              </p>
              <p className="journal-recovery__meta">
                Triggered by {recovery.causeLine} · active for {recovery.durationTrades} trade{recovery.durationTrades === 1 ? "" : "s"}
              </p>
            </header>
            <div className="journal-recovery__grid">
              <article className="journal-recovery__panel">
                <h3>Constraints</h3>
                <ul>
                  {recovery.constraints.map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
              </article>
              <article className="journal-recovery__panel">
                <h3>Recovery goal</h3>
                <p className="journal-recovery__goal">{recovery.goalLabel}</p>
                <div className="journal-recovery__progress">
                  <span style={{ width: `${recovery.progressPct}%` }} />
                </div>
                <p className="journal-recovery__progress-label">
                  {recovery.progressLabel} · {recovery.progressPct}%
                </p>
                <p className="journal-recovery__insight">{recovery.insight}</p>
              </article>
            </div>
          </section>
        ) : null}

        <section className="journal-dash__state" aria-label="Behavior status verdict">
          <div className="journal-dash__state-grid">
            <div className="journal-dash__state-main">
              <p className="journal-dash__eyebrow">Behavior verdict</p>
              <h2 className="journal-dash__state-label">
                {behaviorStatus}{" "}
                <span className="journal-dash__state-direction">
                  {directionGlyph(stateDelta.trend)}
                  {stateDelta.delta == null ? "(N/A)" : `(${stateDelta.delta > 0 ? "+" : ""}${stateDelta.delta})`}
                </span>
              </h2>
              <p className="journal-dash__state-summary">{behaviorInterpretation}</p>
              <p className="journal-dash__state-cause">
                Trade context: {vm.entryCount} closed trade{vm.entryCount === 1 ? "" : "s"} · {vm.systemStateSummary}
              </p>
              <p className="journal-dash__state-cause">
                Driven by: {drivers[0] ?? "no dominant behavior driver"}
                {drivers[1] ? `, ${drivers[1]}` : ""}
              </p>
              <div className="journal-dash__state-explanation" aria-label="State explanation">
                <p>System guidance:</p>
                <p className="journal-dash__muted" style={{ marginTop: "var(--space-1)" }}>{behaviorGuidance}</p>
                <p style={{ marginTop: "var(--space-2)" }}>Detected from:</p>
                <ul>
                  {state.evidence.map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
              </div>
            </div>
            <dl className="journal-dash__state-metrics">
              <div>
                <dt>Discipline score</dt>
                <dd>{state.disciplineScore}</dd>
              </div>
              <div>
                <dt>Risk level</dt>
                <dd>{state.riskLevel}</dd>
              </div>
              <div>
                <dt>Trade count</dt>
                <dd>{vm.entryCount}</dd>
              </div>
              <div>
                <dt>Window delta</dt>
                <dd>
                  {stateDelta.delta == null ? "N/A" : `${stateDelta.delta > 0 ? "+" : ""}${stateDelta.delta} vs previous window`}
                </dd>
              </div>
              <div>
                <dt>Behavior shift</dt>
                <dd>
                  {stateDelta.trend === "insufficient"
                    ? "Insufficient data"
                    : stateDelta.trend === "flat"
                      ? "Stable"
                      : stateDelta.trend === "improving"
                        ? "Improving"
                        : "Declining"}
                </dd>
              </div>
            </dl>
          </div>
          <Sparkline points={state.sparkline} />
        </section>

        {vm.loading ? (
          <p className="journal-learn__muted journal-learn__loading">Syncing closes from the server — dashboard modules are preparing.</p>
        ) : vm.isError ? (
          <section className="journal-learn__block" aria-live="polite">
            <p className="journal-learn__muted">Journal feed could not be loaded. Check connection and try again.</p>
            <Link className="journal-learn__cta journal-learn__cta--ghost" to={ROUTES.markets}>
              Go to Markets
            </Link>
          </section>
        ) : (
          <>
            {vm.showPrimaryAction ? (
              <section className="journal-learn__block journal-learn__block--primary" aria-label="Activate learning">
                <p className="journal-learn__primary-text">Start logging your trades to activate learning.</p>
                <Link className="journal-learn__cta" to={ROUTES.markets}>
                  Go to Markets
                </Link>
              </section>
            ) : null}

            {vm.entryCount > 0 ? (
              <>
                <section ref={chartSectionRef} className="journal-dash__chart" aria-label="Execution timeline">
                  <div className="journal-dash__panel-head">
                    <h2>Execution Timeline</h2>
                    <p>
                      {isEarlyStageChart
                        ? "Early stage - insufficient data for trend"
                        : `Recent trades mapped by behavior score · ${slope.text}`}
                    </p>
                  </div>
                  <div className="mb-3 rounded-lg border border-slate-800/80 bg-slate-900/40 px-3 py-2 text-xs text-slate-300">
                    <p className="font-semibold uppercase tracking-wide text-slate-500">Last 10 trades summary</p>
                    <p className="mt-1">
                      Disciplined: <span className="text-emerald-300">{disciplinedCount}</span> · Deviation:{" "}
                      <span className="text-rose-300">{deviationCount}</span>
                    </p>
                    <p className="mt-1 text-slate-400">{timelineInterpretation}</p>
                  </div>
                  <BehaviorChart
                    points={points}
                    showTrendLine={!isEarlyStageChart && points.length >= 10}
                    highlightedCardId={highlightedCardId}
                    onHighlightCard={setHighlightedCardId}
                    onHoverPoint={setHoveredPoint}
                    onPointClick={(cardId) => {
                      setHighlightedCardId(cardId);
                      tradeCardRefs.current[cardId]?.scrollIntoView({ behavior: "smooth", block: "center" });
                    }}
                  />
                  {hoveredPoint ? (
                    <div className="journal-dash__hover-readout" role="status" aria-live="polite">
                      <span className="journal-dash__hover-symbol">{hoveredPoint.symbol}</span>
                      <span>{hoveredPoint.dateLabel}</span>
                      <span>{hoveredPoint.marker}</span>
                      <span>{hoveredPoint.impactScore > 0 ? "+" : ""}{hoveredPoint.impactScore} impact</span>
                    </div>
                  ) : (
                    <p className="journal-dash__hover-hint">Hover points to see trade + behavior marker. Click a point to jump to the trade card.</p>
                  )}
                </section>

                <section className="journal-dash__split" aria-label="Repeated patterns and insights">
                  <article className="journal-dash__panel journal-dash__pattern-panel">
                    <div className="journal-dash__panel-head">
                      <h2>Dominant Behavior Pattern</h2>
                      <p>Current 10-trade window vs previous 10</p>
                    </div>
                    {dominantPattern ? (
                      <p className="journal-dash__pattern-dominant">
                        Pattern: {dominantPattern.label} ({dominantPattern.count}/10) · Change{" "}
                        {dominantPattern.delta > 0 ? "+" : ""}
                        {dominantPattern.delta} vs previous window
                      </p>
                    ) : null}
                    <ul className="journal-dash__pattern-list">
                      {patternStats.map((p) => (
                        <li key={p.key} className="journal-dash__pattern-row">
                          <span className="journal-dash__pattern-label">{p.label}</span>
                          <span className="journal-dash__pattern-count">{p.count}</span>
                          <span className="journal-dash__pattern-bar" aria-hidden>
                            <span style={{ width: `${p.pct}%` }} />
                          </span>
                          <span className="journal-dash__pattern-pct">
                            {p.pct}% {p.delta !== 0 ? `(${p.delta > 0 ? "+" : ""}${p.delta})` : "(0)"}
                          </span>
                        </li>
                      ))}
                    </ul>
                    <p className="journal-dash__pattern-impact">
                      {dominantPatternInterpretation}
                    </p>
                  </article>

                  <article className="journal-dash__panel journal-dash__insight-panel" aria-label="System guidance insights">
                    <div className="journal-dash__panel-head">
                      <h2>System Guidance</h2>
                      <p>Observation → Implication → Action</p>
                    </div>
                    <div className="journal-dash__guidance-stack">
                      {guidance.map((g) => (
                        <article key={`${g.observation}-${g.implication}`} className="journal-dash__guidance">
                          <p>
                            <strong>Observation:</strong> {g.observation}
                          </p>
                          <p>
                            <strong>Implication:</strong> {g.implication}
                          </p>
                          <p>
                            <strong>Action:</strong> {g.action}
                          </p>
                        </article>
                      ))}
                    </div>
                  </article>
                </section>

                <section className="journal-dash__filters" aria-label="Trade filters">
                  <div className="journal-dash__filter-group">
                    <button
                      type="button"
                      className={tradeFilter === "all" ? "is-active" : ""}
                      onClick={() => setTradeFilter("all")}
                    >
                      All
                    </button>
                    <button
                      type="button"
                      className={tradeFilter === "good" ? "is-active" : ""}
                      onClick={() => setTradeFilter("good")}
                    >
                      Good trades
                    </button>
                    <button
                      type="button"
                      className={tradeFilter === "bad" ? "is-active" : ""}
                      onClick={() => setTradeFilter("bad")}
                    >
                      Bad trades
                    </button>
                  </div>
                  <div className="journal-dash__filter-group">
                    <label htmlFor="journal-pattern-filter">Pattern</label>
                    <select
                      id="journal-pattern-filter"
                      value={patternFilter}
                      onChange={(e) => setPatternFilter(e.target.value as PatternKey)}
                    >
                      <option value="all">All patterns</option>
                      <option value="disciplined">Disciplined</option>
                      <option value="revenge">Revenge</option>
                      <option value="early_exit">Early Exit</option>
                      <option value="panic">Panic</option>
                      <option value="holding_losers">Holding losers</option>
                    </select>
                  </div>
                  <div className="journal-dash__filter-group">
                    <label htmlFor="journal-range-filter">Time range</label>
                    <select
                      id="journal-range-filter"
                      value={rangeFilter}
                      onChange={(e) => setRangeFilter(e.target.value as RangeFilter)}
                    >
                      <option value="all">All</option>
                      <option value="30d">Last 30 days</option>
                      <option value="90d">Last 90 days</option>
                    </select>
                  </div>
                </section>

                <section className="journal-dash__trades" aria-label="Trade cards">
                  {filteredCards.length > 0 ? (
                    filteredCards.map((c) => {
                      const judgment = tradeSystemJudgment(c.tone, c.verdict);
                      const alignmentLabel =
                        judgment === "Execution aligned"
                          ? "Execution aligned"
                          : judgment === "Deviation detected"
                            ? "Deviation detected"
                            : judgment === "Unstable"
                              ? "Unstable / guided control"
                              : "Controlled";

                      return (
                      <article
                        key={c.id}
                        ref={(el) => {
                          tradeCardRefs.current[c.id] = el;
                        }}
                        className={`journal-dash__trade-card journal-dash__trade-card--${c.tone}${
                          highlightedCardId === c.id ? " is-highlighted" : ""
                        }`}
                        onClick={() => {
                          setHighlightedCardId(c.id);
                          chartSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
                        }}
                        onMouseEnter={() => setHighlightedCardId(c.id)}
                        onMouseLeave={() => setHighlightedCardId(null)}
                      >
                        <header className="journal-dash__trade-head">
                          <div>
                            <h3>{c.symbol}</h3>
                            <p>{c.dateLabel}</p>
                          </div>
                          <div className="journal-dash__trade-result">
                            <span className={c.resultPositive ? "is-plus" : "is-minus"}>{c.resultPctLabel}</span>
                            <span>{tradeBehaviorLabel(c.pattern)}</span>
                          </div>
                        </header>

                        <div className="journal-dash__score-grid">
                          <p>
                            <span>setup</span>
                            <span>{c.setupScore}</span>
                            <span>{barText(c.setupScore)}</span>
                          </p>
                          <p>
                            <span>market</span>
                            <span>{c.marketScore}</span>
                            <span>{barText(c.marketScore)}</span>
                          </p>
                          <p>
                            <span>behavior</span>
                            <span>{c.behaviorScore}</span>
                            <span>{barText(c.behaviorScore)}</span>
                          </p>
                        </div>

                        <p className="journal-dash__trade-line">
                          <strong>Entry:</strong> {c.entrySummary}
                        </p>
                        <p className="journal-dash__trade-line">
                          <strong>Exit:</strong> {c.exitSummary}
                        </p>
                        <p className="journal-dash__trade-line">
                          <strong>System posture:</strong> {judgment} · <strong>Alignment:</strong> {alignmentLabel}
                        </p>
                        <p className="journal-dash__trade-line journal-dash__trade-line--impact">
                          <strong>Behavior impact:</strong> {c.impactScore > 0 ? "+" : ""}
                          {c.impactScore} ({c.impactNarrative})
                          {c.causedShift ? <span className="journal-dash__impact-shift"> · trend shift</span> : null}
                        </p>
                        <p className="journal-dash__trade-line">
                          <strong>Lesson:</strong> {c.lesson}
                        </p>
                      </article>
                      );
                    })
                  ) : (
                    <p className="journal-dash__muted">No trades match the selected filter combination.</p>
                  )}
                </section>

                <section className="journal-dash__heatmap" aria-label="Discipline heatmap">
                  <div className="journal-dash__panel-head">
                    <h2>Discipline heatmap</h2>
                    <p>Daily intensity based on behavioral score</p>
                  </div>
                  <p className="mb-2 text-xs text-slate-400">
                    Legend: <span className="text-emerald-300">green = disciplined</span> ·{" "}
                    <span className="text-rose-300">red = deviation</span> · muted = no trade
                  </p>
                  <div className="journal-dash__heatmap-grid">
                    {heatCells.map((cell) => (
                      <span
                        key={cell.key}
                        className={`journal-dash__heat-cell ${
                          cell.score == null
                            ? "is-empty"
                            : cell.score >= 75
                              ? "is-high"
                              : cell.score >= 55
                                ? "is-mid"
                                : "is-low"
                        }`}
                        title={`${cell.dateLabel}: ${cell.score == null ? "No trades" : `${cell.score}`}`}
                      />
                    ))}
                  </div>
                  <p className="mt-2 text-xs text-slate-400">{heatmapInsight}</p>
                </section>
              </>
            ) : (
              <section className="journal-learn__block journal-learn__muted" aria-label="Guidance">
                <p>
                  Execute from Markets to create your first entry log. Closed round-trips build this dashboard once
                  you exit with reflection.
                </p>
              </section>
            )}
          </>
        )}

        <footer className="journal-learn__footer">
          <p className="journal-learn__footer-line">More data improves system accuracy</p>
        </footer>
      </div>
    </AppLayout>
  );
}
