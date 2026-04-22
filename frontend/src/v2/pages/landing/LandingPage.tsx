import { Fragment, useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../../features/auth/useAuth.jsx";
import { ROUTES } from "../../routing/routes";
import PublicNav from "../public/PublicNav";
import HeroLiveSystemCheck from "./HeroLiveSystemCheck";

const BOOT_MESSAGES = [
  "Initializing system…",
  "Loading market context…",
  "Preparing evaluation engine…",
] as const;

function SectionTitle({ kicker, title }: { kicker: string; title: string }) {
  return (
    <div className="mb-8 max-w-2xl">
      <p className="m-0 font-mono text-[length:var(--text-2xs)] font-semibold uppercase tracking-[var(--tracking-widest)] text-[var(--v2-text-muted)]">
        {kicker}
      </p>
      <h2
        className="mt-2 text-balance font-bold tracking-tight text-[var(--v2-text-primary)]"
        style={{ fontSize: "var(--text-2xl)" }}
      >
        {title}
      </h2>
    </div>
  );
}

function LandingBackdrop() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      <div
        className="absolute -left-[20%] top-0 h-full w-[70%] opacity-[0.2] max-md:opacity-[0.11]"
        style={{
          background:
            "radial-gradient(ellipse 68% 55% at 28% 28%, color-mix(in srgb, var(--v2-accent-primary) 12%, transparent) 0%, transparent 58%)",
        }}
      />
      <div
        className="absolute bottom-0 right-0 h-[72%] w-[55%] opacity-[0.12] max-md:opacity-[0.07]"
        style={{
          background:
            "radial-gradient(ellipse 58% 46% at 82% 78%, color-mix(in srgb, var(--v2-accent-primary) 8%, transparent) 0%, transparent 56%)",
        }}
      />
      <div
        className="absolute inset-0 opacity-[0.055] max-md:opacity-[0.035]"
        style={{
          backgroundImage: `
            linear-gradient(color-mix(in srgb, var(--v2-text-primary) 12%, transparent) 1px, transparent 1px),
            linear-gradient(90deg, color-mix(in srgb, var(--v2-text-primary) 12%, transparent) 1px, transparent 1px)
          `,
          backgroundSize: "44px 44px",
        }}
      />
      <div
        className="absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage: "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.55'/%3E%3C/svg%3E\")",
          backgroundSize: "180px 180px",
        }}
      />
    </div>
  );
}

export default function LandingPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const terminalTo = user ? ROUTES.dashboard : ROUTES.login;

  const [bootOpen, setBootOpen] = useState(false);
  const [bootLine, setBootLine] = useState(0);
  const bootTimers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const clearBootTimers = useCallback(() => {
    bootTimers.current.forEach(clearTimeout);
    bootTimers.current = [];
  }, []);

  useEffect(() => {
    return () => clearBootTimers();
  }, [clearBootTimers]);

  const beginSystemEntry = useCallback(() => {
    clearBootTimers();
    setBootOpen(true);
    setBootLine(0);
    bootTimers.current.push(
      setTimeout(() => setBootLine(1), 520),
      setTimeout(() => setBootLine(2), 1040),
      setTimeout(() => {
        setBootOpen(false);
        setBootLine(0);
        navigate(terminalTo);
      }, 1680),
    );
  }, [clearBootTimers, navigate, terminalTo]);

  useEffect(() => {
    const id = window.location.hash.replace(/^#/, "");
    if (!id) return;
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  const shell = "relative min-h-screen overflow-x-hidden bg-[var(--v2-bg-base)] text-[var(--v2-text-primary)]";
  const band = "border-y border-[var(--v2-border-subtle)] bg-[var(--v2-bg-section)]";
  const inner = "mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20";

  const pipelineSteps = ["Plan", "Evaluate", "Verdict", "Execute", "Reflect"] as const;

  const principles = [
    {
      t: "Deterministic decisions",
      d: "Same inputs and rules yield the same evaluation — no stochastic “model mood.”",
      i: "Replay any verdict from logged inputs; no hidden randomness in the gate path.",
    },
    {
      t: "Constraint-first design",
      d: "Risk and policy gates run before execution, not as post-hoc commentary.",
      i: "If a constraint fails, execution does not proceed — the system refuses first.",
    },
    {
      t: "Human-in-the-loop",
      d: "The system surfaces judgment; it does not replace yours.",
      i: "You author thesis, state, and size; the system enforces alignment, not autopilot.",
    },
    {
      t: "Process over outcome",
      d: "A good outcome with a broken process still fails the audit.",
      i: "Closure and journal treat intent and discipline as first-class evidence.",
    },
  ] as const;

  const surfaces = [
    {
      t: "Execution surface",
      d: "Order workspace, risk brackets, and the path from verdict to submit — under system policy.",
    },
    {
      t: "Pre-trade gate",
      d: "Structured thesis, emotion state, and server checks before capital is committed.",
    },
    {
      t: "Behavior engine",
      d: "Historical execution patterns inform guidance and caps — not predictions, posture.",
    },
    {
      t: "Reflection system",
      d: "Journal, weekly discipline, and trace — intent and outcomes bound into an audit trail.",
    },
  ] as const;

  return (
    <div className={shell}>
      <LandingBackdrop />
      <div className="relative z-10">
        <PublicNav />

        <main>
          {/* 1 — Hero */}
          <section className={`relative overflow-hidden ${band} border-t-0`}>
            <div className={`${inner} relative py-20 sm:py-24`}>
              <div className="grid gap-12 lg:grid-cols-[1fr_minmax(280px,380px)] lg:items-center">
                <div>
                  <p className="m-0 font-mono text-[length:var(--text-2xs)] font-semibold uppercase tracking-[var(--tracking-widest)] text-[var(--v2-text-muted)]">
                    Indian equities · simulation
                  </p>
                  <h1
                    className="mt-4 max-w-3xl text-balance font-black leading-[1.12] tracking-tight text-[var(--v2-text-primary)]"
                    style={{ fontSize: "var(--text-4xl)" }}
                  >
                    Trade decisions are evaluated before execution.
                    <br />
                    Outcomes are judged after closure.
                    <br />
                    <span className="text-[color-mix(in_srgb,var(--v2-text-primary)_88%,var(--v2-accent-primary)_12%)]">
                      This system enforces both.
                    </span>
                  </h1>
                  <p
                    className="mt-5 max-w-xl text-pretty leading-relaxed text-[var(--v2-text-secondary)]"
                    style={{ fontSize: "var(--text-md)" }}
                  >
                    A behavior-aware trading system for Indian equities that records why you trade, evaluates decisions
                    before execution, and judges process after it closes.
                  </p>
                  <ul className="mt-6 max-w-xl list-none space-y-2 p-0 text-[length:var(--text-sm)] text-[var(--v2-text-muted)]">
                    <li className="flex gap-2">
                      <span className="shrink-0 font-mono text-[var(--v2-text-accent)]">—</span>
                      <span>No black boxes. No AI decisions. Deterministic engines. Auditable rules.</span>
                    </li>
                  </ul>
                  <div className="mt-8 flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={beginSystemEntry}
                      className="inline-flex items-center justify-center rounded-[var(--radius-md)] border border-[var(--v2-accent-border)] bg-[var(--v2-accent-primary)] px-5 py-2.5 text-[length:var(--text-sm)] font-bold uppercase tracking-wide text-[var(--v2-text-inverse)] transition-opacity hover:opacity-90"
                    >
                      Enter decision terminal →
                    </button>
                    <a
                      href="#system-mechanics"
                      className="inline-flex items-center justify-center rounded-[var(--radius-md)] border border-[var(--v2-border-strong)] bg-transparent px-5 py-2.5 text-[length:var(--text-sm)] font-semibold uppercase tracking-wide text-[var(--v2-text-primary)] no-underline transition-colors hover:border-[var(--v2-accent-border)]"
                    >
                      Review system mechanics
                    </a>
                  </div>
                </div>
                <HeroLiveSystemCheck />
              </div>
            </div>
          </section>

          {/* 2 — Gap */}
          <section id="audit-gap" className="relative scroll-mt-24">
            <div className={inner}>
              <SectionTitle kicker="Audit gap" title="Intent is not logged by default." />
              <p
                className="m-0 max-w-2xl whitespace-pre-line text-pretty leading-relaxed text-[var(--v2-text-secondary)]"
                style={{ fontSize: "var(--text-md)" }}
              >
                {`Most platforms record what you did.
They do not record why you did it.
So your process cannot be audited.`}
              </p>
            </div>
          </section>

          {/* 3 — Principles */}
          <section id="principles" className={`relative ${band} scroll-mt-24`}>
            <div className={inner}>
              <SectionTitle kicker="Operating doctrine" title="Core principles" />
              <div className="grid gap-4 sm:grid-cols-2">
                {principles.map((c) => (
                  <article
                    key={c.t}
                    className="rounded-[var(--radius-lg)] border border-[var(--v2-border-subtle)] bg-[var(--v2-bg-card)] p-5 transition-shadow hover:shadow-[var(--shadow-accent)]"
                  >
                    <h3 className="m-0 text-[length:var(--text-md)] font-bold text-[var(--v2-text-primary)]">{c.t}</h3>
                    <p className="mt-2 mb-0 text-[length:var(--text-sm)] leading-relaxed text-[var(--v2-text-secondary)]">
                      {c.d}
                    </p>
                    <p className="mt-3 border-t border-[var(--v2-border-subtle)] pt-3 font-mono text-[length:var(--text-2xs)] font-medium leading-snug text-[var(--v2-text-accent)]">
                      → {c.i}
                    </p>
                  </article>
                ))}
              </div>
            </div>
          </section>

          {/* 4 — Pipeline */}
          <section id="system-mechanics" className="relative scroll-mt-24">
            <div className={inner}>
              <SectionTitle kicker="Pipeline" title="How the system runs a decision" />
              <div className="flex flex-col lg:flex-row lg:items-stretch lg:gap-0">
                {pipelineSteps.map((step, i) => (
                  <Fragment key={step}>
                    <div className="flex min-h-[4.5rem] flex-1 flex-col justify-center rounded-[var(--radius-lg)] border border-[var(--v2-border-subtle)] bg-[var(--v2-bg-card)] px-4 py-4 lg:min-h-0 lg:rounded-none lg:border-y lg:border-l lg:first:rounded-l-[var(--radius-lg)] lg:last:rounded-r-[var(--radius-lg)] lg:last:border-r">
                      <span className="font-mono text-[length:var(--text-2xs)] font-bold uppercase tracking-wide text-[var(--v2-text-accent)]">
                        Stage {String(i + 1).padStart(2, "0")}
                      </span>
                      <span className="mt-1 text-[length:var(--text-sm)] font-semibold text-[var(--v2-text-primary)]">{step}</span>
                    </div>
                    {i < pipelineSteps.length - 1 ? (
                      <div
                        className="flex justify-center py-1 text-[var(--v2-text-muted)] lg:w-11 lg:shrink-0 lg:items-center lg:self-stretch lg:py-0"
                        aria-hidden
                      >
                        <span className="font-mono text-lg leading-none lg:hidden">↓</span>
                        <span className="hidden font-mono text-lg leading-none lg:inline">→</span>
                      </div>
                    ) : null}
                  </Fragment>
                ))}
              </div>
              <p className="mt-6 max-w-2xl text-pretty font-mono text-[length:var(--text-xs)] leading-relaxed text-[var(--v2-text-secondary)]">
                Each stage produces a trace. Nothing is hidden.
              </p>
            </div>
          </section>

          {/* 5 — System surfaces */}
          <section id="system-surfaces" className={`relative ${band} scroll-mt-24`}>
            <div className={inner}>
              <SectionTitle kicker="System surfaces" title="Where discipline is enforced" />
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {surfaces.map((f) => (
                  <div key={f.t} className="rounded-[var(--radius-lg)] border border-[var(--v2-border-subtle)] bg-[var(--v2-bg-card)] p-5">
                    <h3 className="m-0 text-[length:var(--text-sm)] font-bold text-[var(--v2-text-primary)]">{f.t}</h3>
                    <p className="mt-2 mb-0 text-[length:var(--text-xs)] leading-relaxed text-[var(--v2-text-muted)]">{f.d}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* 6 — System boundaries */}
          <section id="system-boundaries" className="relative scroll-mt-24">
            <div className={inner}>
              <SectionTitle kicker="Trust model" title="System boundaries" />
              <p className="mb-6 max-w-2xl text-pretty text-[var(--v2-text-secondary)]" style={{ fontSize: "var(--text-sm)" }}>
                This system trains process, not capital deployment. Boundaries exist so you know exactly what is being
                proven in simulation.
              </p>
              <ul className="m-0 max-w-2xl list-none space-y-3 p-0 text-[length:var(--text-sm)] text-[var(--v2-text-secondary)]">
                <li className="flex gap-2">
                  <span className="shrink-0 font-mono text-[var(--v2-text-muted)]">│</span>
                  <span>
                    <strong className="text-[var(--v2-text-primary)]">Simulation book.</strong> No real capital at
                    risk; fills and balances are synthetic — discipline is real, money movement is not.
                  </span>
                </li>
                <li className="flex gap-2">
                  <span className="shrink-0 font-mono text-[var(--v2-text-muted)]">│</span>
                  <span>
                    <strong className="text-[var(--v2-text-primary)]">No broker path.</strong> No exchange
                    connectivity, clearing, or regulatory execution — the terminal is an evaluation environment.
                  </span>
                </li>
                <li className="flex gap-2">
                  <span className="shrink-0 font-mono text-[var(--v2-text-muted)]">│</span>
                  <span>
                    <strong className="text-[var(--v2-text-primary)]">Market data limits.</strong> Snapshots and
                    context can lag or be incomplete — verify externally before any real-world decision.
                  </span>
                </li>
              </ul>
            </div>
          </section>

          {/* 7 — System origin (creator philosophy on-landing) */}
          <section id="system-origin" className={`relative ${band} scroll-mt-24`}>
            <div className={inner}>
              <SectionTitle kicker="System origin" title="Why this exists" />
              <div className="max-w-2xl space-y-5 text-pretty leading-relaxed text-[var(--v2-text-secondary)]" style={{ fontSize: "var(--text-md)" }}>
                <p className="m-0">
                  Most trading products optimize for activation: open the app, tap trade, move on. This system optimizes
                  for <strong className="font-semibold text-[var(--v2-text-primary)]">defensible decisions</strong> —
                  the kind you can explain to yourself a week later when the chart no longer flatters you.
                </p>
                <p className="m-0">
                  NOESIS exists to enforce a loop: <strong className="font-semibold text-[var(--v2-text-primary)]">intent</strong>{" "}
                  before risk, <strong className="font-semibold text-[var(--v2-text-primary)]">verdict</strong> before
                  execution, <strong className="font-semibold text-[var(--v2-text-primary)]">reflection</strong> after
                  closure. The goal is not to maximize trades; it is to make the ones you take structurally legible.
                </p>
              </div>
              <p className="mt-10 font-mono text-[length:var(--text-2xs)] uppercase tracking-[var(--tracking-widest)] text-[var(--v2-text-muted)]">
                Implementation
              </p>
              <p className="mt-2 max-w-2xl text-[length:var(--text-xs)] leading-relaxed text-[var(--v2-text-muted)]">
                React · TypeScript · Vite on the client; Node services behind the API. Stack and build choices are
                secondary to the contract:{" "}
                <span className="text-[var(--v2-text-secondary)]">every stage leaves a trace.</span>{" "}
                <Link to={ROUTES.creator} className="text-[var(--v2-text-accent)] no-underline hover:underline">
                  Creator page
                </Link>{" "}
                for tooling detail.
              </p>
            </div>
          </section>

          {/* 8 — Final CTA */}
          <section className={`relative ${band} scroll-mt-24`}>
            <div className={`${inner} py-16 text-center`}>
              <p
                className="m-0 text-balance font-bold tracking-tight text-[var(--v2-text-primary)]"
                style={{ fontSize: "var(--text-2xl)" }}
              >
                Enter the system.
                <br />
                See how your decisions hold up.
              </p>
              <button
                type="button"
                onClick={beginSystemEntry}
                className="mt-6 inline-flex items-center justify-center rounded-[var(--radius-md)] border border-[var(--v2-accent-border)] bg-[var(--v2-accent-soft)] px-6 py-3 text-[length:var(--text-sm)] font-bold uppercase tracking-wide text-[var(--v2-text-accent)] transition-opacity hover:opacity-90"
              >
                Enter decision terminal →
              </button>
            </div>
          </section>
        </main>

        <footer className="relative border-t border-[var(--v2-border-subtle)] py-8 text-center">
          <p className="m-0 text-[length:var(--text-xs)] text-[var(--v2-text-muted)]">
            Built by Shreyash Jadhav ·{" "}
            <Link to={ROUTES.creator} className="text-[var(--v2-text-accent)] no-underline hover:underline">
              Creator
            </Link>
            {" · "}
            <a href="#system-origin" className="text-[var(--v2-text-accent)] no-underline hover:underline">
              Why this exists
            </a>
          </p>
        </footer>
      </div>

      {bootOpen ? (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-[color-mix(in_srgb,black_62%,transparent)] px-6 backdrop-blur-sm"
          role="status"
          aria-live="polite"
          aria-label="System initialization"
        >
          <div className="w-full max-w-md rounded-[var(--radius-lg)] border border-[var(--v2-border-subtle)] bg-[color-mix(in_srgb,var(--v2-bg-card)_92%,black_8%)] px-6 py-8 text-center shadow-[0_0_0_1px_color-mix(in_srgb,var(--v2-accent-primary)_18%,transparent),0_28px_80px_-28px_color-mix(in_srgb,var(--v2-accent-primary)_40%,transparent)]">
            <p className="m-0 font-mono text-[length:var(--text-2xs)] font-semibold uppercase tracking-[var(--tracking-widest)] text-[var(--v2-text-muted)]">
              System initiation
            </p>
            <p className="mt-4 font-mono text-[length:var(--text-sm)] font-medium text-[var(--v2-text-primary)]">
              {BOOT_MESSAGES[bootLine]}
            </p>
            <div className="mt-6 flex justify-center gap-1.5" aria-hidden>
              {BOOT_MESSAGES.map((_, i) => (
                <span
                  key={`boot-dot-${i}`}
                  className={`h-1.5 w-6 rounded-full ${i <= bootLine ? "bg-[var(--v2-accent-primary)]" : "bg-[var(--v2-border-subtle)]"}`}
                />
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
