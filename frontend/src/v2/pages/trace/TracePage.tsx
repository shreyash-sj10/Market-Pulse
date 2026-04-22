import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import AppLayout from "../../layout/AppLayout/AppLayout.jsx";
import { useTraceData } from "../../hooks/useTraceData";
import { ROUTES } from "../../routing/routes";
import type { TraceTimelineEntry } from "./buildTraceTimeline";

type TraceFilter = "all" | "allowed" | "blocked" | "disciplined" | "poor";
type TradeStage = "pre" | "execution" | "exit";

type TradeEvent = TraceTimelineEntry & {
  stage: TradeStage;
  rawText: string;
  inferredAction: string;
};

type TradeCard = {
  id: string;
  symbol: string;
  price: string;
  action: string;
  verdict: "BUY" | "BLOCK";
  confidence: number;
  setupScore: number;
  marketScore: number;
  behaviorScore: number;
  quality: "disciplined" | "poor_process";
  reasonBullets: string[];
  blockReason: string | null;
  blockFlag: string | null;
  blockAction: string | null;
  events: TradeEvent[];
};

const STOPWORDS = new Set([
  "ACT",
  "BLOCK",
  "GUIDE",
  "WARN",
  "INFO",
  "SYSTEM",
  "ORDER",
  "ENTRY",
  "EXIT",
  "PRICE",
  "MARKET",
  "TRADE",
  "TRACE",
]);

function clamp(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

function avg(nums: number[]): number {
  if (nums.length === 0) return 0;
  return nums.reduce((sum, n) => sum + n, 0) / nums.length;
}

function inferSymbol(event: TraceTimelineEntry): string {
  const blob = `${event.eventSummary} ${event.reason} ${event.sourceType}`.toUpperCase();
  const match = blob.match(/\b[A-Z]{2,6}\b/g) ?? [];
  const symbol = match.find((tok) => !STOPWORDS.has(tok));
  return symbol ?? "—";
}

function inferPrice(event: TraceTimelineEntry): string {
  const blob = `${event.eventSummary} ${event.reason}`;
  const m = blob.match(/(?:₹|\$|INR\s*)?\s*(\d{2,6}(?:\.\d{1,2})?)/);
  return m?.[1] ? `₹${m[1]}` : "—";
}

function inferAction(event: TraceTimelineEntry): string {
  const blob = `${event.eventSummary} ${event.reason} ${event.sourceType}`.toUpperCase();
  if (/BUY|LONG|ENTRY/.test(blob)) return "BUY";
  if (/SELL|SHORT|EXIT|CLOSE/.test(blob)) return "SELL";
  if (event.decision?.action === "ACT") return "BUY";
  if (event.decision?.action === "BLOCK" || event.kind === "BLOCK") return "BLOCK";
  return "HOLD";
}

function inferStage(event: TraceTimelineEntry): TradeStage {
  const blob = `${event.eventSummary} ${event.reason} ${event.sourceType}`.toLowerCase();
  if (/block|setup|signal|checklist|evaluate|pre/.test(blob) || event.kind === "BLOCK" || event.kind === "WARN") {
    return "pre";
  }
  if (/fill|execute|entry|placed|act/.test(blob) || event.kind === "EXEC") {
    return "execution";
  }
  if (/exit|close|reflect|journal|post|review/.test(blob)) {
    return "exit";
  }
  return "execution";
}

function stageLabel(stage: TradeStage): string {
  if (stage === "pre") return "Pre-trade signal";
  if (stage === "execution") return "Execution events";
  return "Exit & outcome";
}

function stageInterpretation(stage: TradeStage, eventCount: number): string {
  if (stage === "pre") {
    return eventCount > 0
      ? "Constraint checks and entry qualification."
      : "No pre-trade qualification record.";
  }
  if (stage === "execution") {
    return eventCount > 0
      ? "Execution path events after decision pass."
      : "No execution event recorded.";
  }
  return eventCount > 0
    ? "Exit handling and recorded outcome context."
    : "No exit or outcome event recorded.";
}

function explainReason(reason: string): string[] {
  const pieces = reason
    .split(/(?:\.\s+|;\s+|\n+)/)
    .map((x) => x.trim())
    .filter(Boolean);
  return (pieces.length > 0 ? pieces : [reason || "System reason unavailable"]).slice(0, 3);
}

function detectPoorProcess(blob: string, confidence: number): boolean {
  if (confidence < 56) return true;
  return /fomo|panic|revenge|overhold|tilt|impulsive|chase/.test(blob.toLowerCase());
}

function tradeVerdictLabel(trade: TradeCard): "Valid" | "Weak" | "Blocked" {
  if (trade.verdict === "BLOCK") return "Blocked";
  if (trade.confidence >= 70 && trade.quality === "disciplined") return "Valid";
  return "Weak";
}

function riskPostureLabel(trade: TradeCard): "Passed constraints" | "Low alignment" | "Blocked posture" {
  if (trade.verdict === "BLOCK") return "Blocked posture";
  if (trade.behaviorScore >= 66 && trade.marketScore >= 62) return "Passed constraints";
  return "Low alignment";
}

function traceEpisodeSynthesis(trade: TradeCard): string {
  const events = trade.events.length;
  const pre = trade.events.filter((e) => e.stage === "pre").length;
  const exec = trade.events.filter((e) => e.stage === "execution").length;
  const exit = trade.events.filter((e) => e.stage === "exit").length;
  if (events === 0) return "No timeline events were captured for this episode.";
  const coverage =
    pre > 0 && exec > 0 && exit > 0
      ? "Pre-trade, execution, and exit stages are represented."
      : pre > 0 && exec > 0
        ? "Pre-trade and execution are represented; exit context is thin."
        : exec > 0
          ? "Execution events dominate the record; pre/exit context is partial."
          : "Most evidence sits in pre-trade checks; execution/exit detail is limited.";
  return `${coverage} (${events} events)`;
}

function summaryInterpretation(total: number, allowed: number, blocked: number, disciplined: number): string {
  if (total === 0) return "No evaluated trades in this window.";
  if (blocked >= Math.ceil(total * 0.45)) return "Blocked pressure is elevated; system posture is restrictive.";
  if (disciplined >= Math.ceil(total * 0.6)) return "Process quality is controlled with majority constraint-compliant outcomes.";
  if (allowed > blocked) return "Execution path is active, but weak-alignment trades remain elevated.";
  return "Decision quality is mixed; maintain strict constraint compliance.";
}

function toCards(entries: TraceTimelineEntry[]): TradeCard[] {
  const sortedAsc = [...entries].sort(
    (a, b) => new Date(a.iso).getTime() - new Date(b.iso).getTime(),
  );

  const groups = new Map<string, TradeEvent[]>();
  let fallbackCounter = 0;

  for (const event of sortedAsc) {
    const symbol = inferSymbol(event);
    const ts = new Date(event.iso).getTime();
    const bucket = Number.isFinite(ts) ? Math.floor(ts / (90 * 60 * 1000)) : fallbackCounter++;
    const key = `${symbol}-${bucket}`;
    const action = inferAction(event);
    const normalized: TradeEvent = {
      ...event,
      stage: inferStage(event),
      rawText: `${event.timeLabel} | ${event.sourceType} | ${event.eventSummary} | ${event.reason}`,
      inferredAction: action,
    };
    const existing = groups.get(key);
    if (existing) existing.push(normalized);
    else groups.set(key, [normalized]);
  }

  const cards: TradeCard[] = [];
  for (const [key, events] of groups.entries()) {
    const sorted = [...events].sort(
      (a, b) => new Date(a.iso).getTime() - new Date(b.iso).getTime(),
    );
    const latest = sorted[sorted.length - 1];
    const symbol = inferSymbol(latest);
    const confidence = clamp(
      avg(
        sorted.map((e) =>
          e.decision?.confidence ??
          (e.confidence != null && Number.isFinite(e.confidence) ? e.confidence : 60),
        ),
      ),
    );
    const verdict: "BUY" | "BLOCK" =
      sorted.some((e) => e.kind === "BLOCK" || e.decision?.action === "BLOCK") ? "BLOCK" : "BUY";
    let action = verdict === "BLOCK" ? "BLOCK" : "BUY";
    for (let i = sorted.length - 1; i >= 0; i -= 1) {
      const a = sorted[i].inferredAction;
      if (a === "BUY" || a === "SELL" || a === "BLOCK") {
        action = a;
        break;
      }
    }
    const price = inferPrice(latest);
    const reasonBullets = explainReason(latest.reason);
    const setupScore = clamp(
      confidence * 0.6 +
      (sorted.filter((e) => e.stage === "pre" && e.kind !== "BLOCK").length / Math.max(1, sorted.length)) * 40,
    );
    const marketScore = clamp(
      confidence * 0.5 +
      (sorted.filter((e) => e.stage === "execution" && e.kind === "EXEC").length / Math.max(1, sorted.length)) * 45 +
      5,
    );
    const behaviorScore = clamp(
      confidence * 0.55 +
      (verdict === "BLOCK" ? 8 : 16) -
      sorted.filter((e) => e.kind === "WARN").length * 8,
    );
    const blob = sorted.map((e) => `${e.eventSummary} ${e.reason}`).join(" ");
    const poorProcess = verdict === "BLOCK" || detectPoorProcess(blob, confidence);
    const blockEvent = sorted.find((e) => e.kind === "BLOCK" || e.decision?.action === "BLOCK") ?? null;
    const blockReason = blockEvent ? blockEvent.reason : null;
    const blockFlag = blockEvent
      ? (/fomo|revenge|overhold|risk|cooldown|drawdown|violation/i.exec(blockEvent.reason)?.[0] ?? "Policy flag")
      : null;
    const blockAction = blockEvent
      ? /cooldown|lock|halt|block/i.test(blockEvent.reason)
        ? "Cooldown / lockout triggered"
        : "Order blocked and routed to review"
      : null;

    cards.push({
      id: key,
      symbol,
      price,
      action,
      verdict,
      confidence,
      setupScore,
      marketScore,
      behaviorScore,
      quality: poorProcess ? "poor_process" : "disciplined",
      reasonBullets,
      blockReason,
      blockFlag,
      blockAction,
      events: sorted,
    });
  }

  return cards.sort((a, b) => {
    const bTs = new Date(b.events[b.events.length - 1]?.iso ?? 0).getTime();
    const aTs = new Date(a.events[a.events.length - 1]?.iso ?? 0).getTime();
    return bTs - aTs;
  });
}

function TraceSkeleton() {
  return (
    <ol className="trace-sys__cards trace-sys__cards--skeleton" aria-busy="true" aria-label="Loading trace">
      {[0, 1, 2, 3].map((i) => (
        <li key={i} className="trace-sys__card trace-sys__card--skeleton" />
      ))}
    </ol>
  );
}

export default function TracePage() {
  const { entries, isLoading, isError, isDegraded } = useTraceData();
  const [filter, setFilter] = useState<TraceFilter>("all");
  const [expandedLogs, setExpandedLogs] = useState<Record<string, boolean>>({});
  const showBanner = isDegraded || (isError && entries.length > 0);
  const cards = useMemo(() => toCards(entries), [entries]);

  const visibleCards = useMemo(() => {
    if (filter === "all") return cards;
    if (filter === "allowed") return cards.filter((c) => c.verdict === "BUY");
    if (filter === "blocked") return cards.filter((c) => c.verdict === "BLOCK");
    if (filter === "disciplined") return cards.filter((c) => c.quality === "disciplined");
    return cards.filter((c) => c.quality === "poor_process");
  }, [cards, filter]);

  const stats = useMemo(() => {
    const total = cards.length;
    const allowed = cards.filter((c) => c.verdict === "BUY").length;
    const blocked = cards.filter((c) => c.verdict === "BLOCK").length;
    const disciplined = cards.filter((c) => c.quality === "disciplined").length;
    const poorProcess = total - disciplined;
    const processQuality =
      total === 0 ? "N/A" : disciplined >= Math.ceil(total * 0.6) ? "Controlled" : "Low alignment";
    return { total, allowed, blocked, disciplined, poorProcess, processQuality };
  }, [cards]);

  return (
    <AppLayout>
      <div className="home-terminal trace-sys">
        <header className="trace-sys__head">
          <h1 className="trace-sys__title">Decision Narrative</h1>
          <p className="trace-sys__lead">Structured judgment path: decision, constraint outcome, and execution trace.</p>
        </header>

        {showBanner && (
          <div className="data-degraded-banner trace-sys__banner" role="status">
            Trace feed degraded — some rows may be missing.
          </div>
        )}

        <section className="trace-sys__summary border border-slate-700/90 bg-slate-900/65 rounded-xl p-3" aria-label="Decision summary">
          <article>
            <p>Trades evaluated</p>
            <strong>{stats.total}</strong>
          </article>
          <article>
            <p>Allowed vs blocked</p>
            <strong>{stats.allowed} / {stats.blocked}</strong>
          </article>
          <article>
            <p>Process quality</p>
            <strong>{stats.processQuality}</strong>
          </article>
          <p className="col-span-3 text-xs text-slate-300 mt-1">
            {summaryInterpretation(stats.total, stats.allowed, stats.blocked, stats.disciplined)}
          </p>
        </section>

        <section className="trace-sys__filters" aria-label="Trade filters">
          {(
            [
              ["all", "All"],
              ["allowed", "Allowed"],
              ["blocked", "Blocked"],
              ["disciplined", "Disciplined"],
              ["poor", "Poor Process"],
            ] as Array<[TraceFilter, string]>
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              className={`trace-sys__filter ${filter === id ? "is-active" : ""}`}
              onClick={() => setFilter(id)}
            >
              {label}
            </button>
          ))}
        </section>

        {isLoading && entries.length === 0 ? (
          <TraceSkeleton />
        ) : isError && entries.length === 0 ? (
          <p className="page-note trace-sys__note">Trace feed unavailable. Retry after refresh.</p>
        ) : !isLoading && entries.length === 0 ? (
          <div className="trace-sys__empty">
            <p className="trace-sys__empty-text">
              No system activity yet
              <br />
              Execute trades to generate trace history
            </p>
            <Link className="trace-sys__cta" to={ROUTES.markets}>
              Go to Markets
            </Link>
          </div>
        ) : (
          <ol className="trace-sys__cards" aria-label="Decision narrative by trade">
            {visibleCards.map((trade) => (
              <li key={trade.id} className="trace-sys__card">
                <section className="trace-sys__card-top">
                  <div className="trace-sys__instrument">
                    <h2>{trade.symbol}</h2>
                    <p>{trade.price} · {trade.action}</p>
                  </div>
                  <div className="trace-sys__verdict-row flex-wrap justify-end">
                    <span
                      className={`trace-sys__verdict ${
                        tradeVerdictLabel(trade) === "Blocked"
                          ? "trace-sys__verdict--block"
                          : tradeVerdictLabel(trade) === "Valid"
                            ? "trace-sys__verdict--buy"
                            : ""
                      }`}
                    >
                      {tradeVerdictLabel(trade)}
                    </span>
                    <span className="trace-sys__confidence">Confidence {trade.confidence}%</span>
                    <span className="trace-sys__confidence">{riskPostureLabel(trade)}</span>
                  </div>
                </section>

                <section className="rounded-md border border-slate-800/80 bg-slate-950/30 px-3 py-2" aria-label="System reason">
                  <h3 className="text-xs uppercase tracking-widest text-slate-400">
                    System reason
                  </h3>
                  {trade.verdict === "BLOCK" ? (
                    <p className="mt-1 text-sm text-slate-200">
                      {trade.blockReason ?? trade.reasonBullets[0] ?? "Constraint rejection."}
                    </p>
                  ) : (
                    <ul className="mt-2 list-disc space-y-1 pl-4 text-sm text-slate-200">
                      {(trade.reasonBullets.length > 0 ? trade.reasonBullets : ["Passed constraints."]).map((b) => (
                        <li key={b}>{b}</li>
                      ))}
                    </ul>
                  )}
                </section>

                <section className="trace-sys__scores" aria-label="Decision scores">
                  <article>
                    <p>Setup score</p>
                    <strong>{trade.setupScore}</strong>
                  </article>
                  <article>
                    <p>Market score</p>
                    <strong>{trade.marketScore}</strong>
                  </article>
                  <article>
                    <p>Behavior score</p>
                    <strong>{trade.behaviorScore}</strong>
                  </article>
                </section>

                {trade.verdict === "BLOCK" && (
                  <section className="trace-sys__blocked" aria-label="Blocked trade details">
                    <h3>Blocked trade details</h3>
                    <p><span>Reason:</span> {trade.blockReason ?? "Policy rejection from trace engine."}</p>
                    <p><span>Flag triggered:</span> {trade.blockFlag ?? "Risk / behavior guardrail"}</p>
                    <p><span>Action taken:</span> {trade.blockAction ?? "Execution blocked"}</p>
                  </section>
                )}

                <section className="trace-sys__timeline" aria-label="Trade event timeline">
                  {(["pre", "execution", "exit"] as TradeStage[]).map((stage) => {
                    const events = trade.events.filter((e) => e.stage === stage);
                    const expanded = Boolean(expandedLogs[`${trade.id}-${stage}`]);
                    const visibleEvents = expanded ? events : events.slice(0, 4);
                    return (
                      <article key={stage} className="trace-sys__stage">
                        <h4>{stageLabel(stage)}</h4>
                        <p className="trace-sys__stage-empty">{stageInterpretation(stage, events.length)}</p>
                        {events.length === 0 ? (
                          <p className="trace-sys__stage-empty">No event recorded.</p>
                        ) : (
                          <>
                            <ul>
                            {visibleEvents.map((event) => (
                              <li key={event.id}>
                                <time dateTime={event.iso}>{event.timeLabel}</time>
                                <span>{event.eventSummary}</span>
                              </li>
                            ))}
                            </ul>
                            {events.length > 4 ? (
                              <button
                                type="button"
                                className="trace-sys__filter mt-2"
                                onClick={() =>
                                  setExpandedLogs((prev) => ({
                                    ...prev,
                                    [`${trade.id}-${stage}`]: !expanded,
                                  }))
                                }
                              >
                                {expanded ? "Show less" : "View full trace"}
                              </button>
                            ) : null}
                          </>
                        )}
                      </article>
                    );
                  })}
                </section>

                <details className="trace-sys__details">
                  <summary>View full raw logs</summary>
                  <ul>
                    {trade.events.map((event) => (
                      <li key={`${event.id}-raw`}>{event.rawText}</li>
                    ))}
                  </ul>
                </details>

                <p className="text-xs text-slate-300">Episode synthesis: {traceEpisodeSynthesis(trade)}</p>
              </li>
            ))}
          </ol>
        )}
      </div>
    </AppLayout>
  );
}
