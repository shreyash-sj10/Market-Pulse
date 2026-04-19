import { useEffect } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../../features/auth/AuthContext.jsx";
import { ROUTES } from "../../routing/routes";
import PublicNav from "../public/PublicNav";
import HeroDecisionPreview from "./HeroDecisionPreview";

function SectionTitle({ kicker, title }: { kicker: string; title: string }) {
  return (
    <div className="mb-8 max-w-2xl">
      <p className="m-0 font-mono text-[length:var(--text-2xs)] font-semibold uppercase tracking-[var(--tracking-widest)] text-[var(--v2-text-muted)]">
        {kicker}
      </p>
      <h2 className="mt-2 text-balance font-bold tracking-tight text-[var(--v2-text-primary)]" style={{ fontSize: "var(--text-2xl)" }}>
        {title}
      </h2>
    </div>
  );
}

export default function LandingPage() {
  const { user } = useAuth();
  const terminalTo = user ? ROUTES.dashboard : ROUTES.login;

  useEffect(() => {
    const id = window.location.hash.replace(/^#/, "");
    if (!id) return;
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  const shell = "min-h-screen bg-[var(--v2-bg-base)] text-[var(--v2-text-primary)]";
  const band = "border-y border-[var(--v2-border-subtle)] bg-[var(--v2-bg-section)]";
  const inner = "mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20";

  return (
    <div className={shell}>
      <PublicNav />

      <main>
        {/* 1 — Hero */}
        <section className={`${band} border-t-0`}>
          <div className={`${inner} py-20 sm:py-24`}>
            <div className="grid gap-12 lg:grid-cols-[1fr_minmax(280px,360px)] lg:items-center">
              <div>
                <p className="m-0 font-mono text-[length:var(--text-2xs)] font-semibold uppercase tracking-[var(--tracking-widest)] text-[var(--v2-text-muted)]">
                  Indian equities · simulation
                </p>
                <h1 className="mt-4 text-balance font-black tracking-tight text-[var(--v2-text-primary)]" style={{ fontSize: "var(--text-4xl)" }}>
                  Process over outcome.
                </h1>
                <p className="mt-5 max-w-xl text-pretty leading-relaxed text-[var(--v2-text-secondary)]" style={{ fontSize: "var(--text-md)" }}>
                  A behavior-aware trading system for Indian equities that records why you trade, evaluates decisions before execution, and judges process
                  after it closes.
                </p>
                <ul className="mt-6 max-w-xl list-none space-y-2 p-0 text-[length:var(--text-sm)] text-[var(--v2-text-muted)]">
                  <li className="flex gap-2">
                    <span className="font-mono text-[var(--v2-text-accent)]">—</span>
                    No black boxes. No AI decisions. Deterministic engines. Auditable rules.
                  </li>
                </ul>
                <div className="mt-8 flex flex-wrap gap-3">
                  <Link
                    to={terminalTo}
                    className="inline-flex items-center justify-center rounded-[var(--radius-md)] border border-[var(--v2-accent-border)] bg-[var(--v2-accent-primary)] px-5 py-2.5 text-[length:var(--text-sm)] font-bold uppercase tracking-wide text-[var(--v2-text-inverse)] no-underline transition-opacity hover:opacity-90"
                  >
                    Launch Terminal
                  </Link>
                  <a
                    href="#how-it-works"
                    className="inline-flex items-center justify-center rounded-[var(--radius-md)] border border-[var(--v2-border-strong)] bg-transparent px-5 py-2.5 text-[length:var(--text-sm)] font-semibold uppercase tracking-wide text-[var(--v2-text-primary)] no-underline transition-colors hover:border-[var(--v2-accent-border)]"
                  >
                    See how it works
                  </a>
                </div>
              </div>
              <HeroDecisionPreview />
            </div>
          </div>
        </section>

        {/* 2 — Problem */}
        <section id="problem" className="scroll-mt-24">
          <div className={inner}>
            <SectionTitle kicker="Gap" title="Platforms record trades, not intent." />
            <p className="m-0 max-w-xl text-pretty text-[var(--v2-text-secondary)]" style={{ fontSize: "var(--text-md)" }}>
              Fills and P&amp;L are logged by default. Intent, constraints, and state usually are not — so process cannot be audited.
            </p>
          </div>
        </section>

        {/* 3 — Principles */}
        <section id="principles" className={`${band} scroll-mt-24`}>
          <div className={inner}>
            <SectionTitle kicker="Operating doctrine" title="Core principles" />
            <div className="grid gap-4 sm:grid-cols-2">
              {[
                {
                  t: "Deterministic decisions",
                  d: "Same inputs and rules yield the same evaluation — no stochastic “model mood.”",
                },
                {
                  t: "Constraint-first design",
                  d: "Risk and policy gates run before execution, not as post-hoc commentary.",
                },
                {
                  t: "Human-in-the-loop",
                  d: "The system surfaces judgment; it does not replace yours.",
                },
                {
                  t: "Process over outcome",
                  d: "A good outcome with a broken process still fails the audit.",
                },
              ].map((c) => (
                <article
                  key={c.t}
                  className="rounded-[var(--radius-lg)] border border-[var(--v2-border-subtle)] bg-[var(--v2-bg-card)] p-5 transition-shadow hover:shadow-[var(--shadow-accent)]"
                >
                  <h3 className="m-0 text-[length:var(--text-md)] font-bold text-[var(--v2-text-primary)]">{c.t}</h3>
                  <p className="mt-2 mb-0 text-[length:var(--text-sm)] leading-relaxed text-[var(--v2-text-secondary)]">{c.d}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* 4 — How it works */}
        <section id="how-it-works" className="scroll-mt-24">
          <div className={inner}>
            <SectionTitle kicker="Pipeline" title="How it works" />
            <ol className="m-0 grid list-none gap-3 p-0 lg:grid-cols-5 lg:gap-4">
              {["Plan trade", "Pre-trade evaluation", "Decision verdict", "Execution", "Reflection"].map((step, i) => (
                <li
                  key={step}
                  className="flex gap-3 rounded-[var(--radius-lg)] border border-[var(--v2-border-subtle)] bg-[var(--v2-bg-card)] p-4 lg:flex-col lg:gap-2"
                >
                  <span className="font-mono text-[length:var(--text-2xs)] font-bold leading-none text-[var(--v2-text-accent)]">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span className="text-[length:var(--text-sm)] font-semibold text-[var(--v2-text-primary)]">{step}</span>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* 5 — Features / Product */}
        <section id="product" className={`${band} scroll-mt-24`}>
          <div className={inner}>
            <SectionTitle kicker="Surface area" title="Features" />
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {[
                { t: "Trade Terminal", d: "Order workspace with risk bracket, side, and execution gate." },
                { t: "Decision Panel", d: "Structured thesis, context, and system checks before you commit." },
                { t: "Behavioral Engine", d: "Signals from your history inform guidance — not autopilot." },
                { t: "Journal & Reflection", d: "Close the loop: intent, execution, and post-trade review." },
              ].map((f) => (
                <div key={f.t} className="rounded-[var(--radius-lg)] border border-[var(--v2-border-subtle)] bg-[var(--v2-bg-card)] p-5">
                  <h3 className="m-0 text-[length:var(--text-sm)] font-bold text-[var(--v2-text-primary)]">{f.t}</h3>
                  <p className="mt-2 mb-0 text-[length:var(--text-xs)] leading-relaxed text-[var(--v2-text-muted)]">{f.d}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* 6 — Limitations */}
        <section className="scroll-mt-24">
          <div className={inner}>
            <SectionTitle kicker="Trust boundary" title="Limitations" />
            <ul className="m-0 max-w-2xl list-none space-y-3 p-0 text-[length:var(--text-sm)] text-[var(--v2-text-secondary)]">
              <li className="flex gap-2">
                <span className="font-mono text-[var(--v2-text-muted)]">[ ]</span>
                <span>
                  <strong className="text-[var(--v2-text-primary)]">Simulation only.</strong> No capital at risk; fills are synthetic.
                </span>
              </li>
              <li className="flex gap-2">
                <span className="font-mono text-[var(--v2-text-muted)]">[ ]</span>
                <span>
                  <strong className="text-[var(--v2-text-primary)]">No real broker.</strong> No exchange connectivity or regulatory clearing.
                </span>
              </li>
              <li className="flex gap-2">
                <span className="font-mono text-[var(--v2-text-muted)]">[ ]</span>
                <span>
                  <strong className="text-[var(--v2-text-primary)]">Data limitations.</strong> Market snapshots and fundamentals may lag or be incomplete;
                  always verify externally before real decisions.
                </span>
              </li>
            </ul>
          </div>
        </section>

        {/* 7 — Final CTA */}
        <section className={`${band} scroll-mt-24`}>
          <div className={`${inner} py-16 text-center`}>
            <p className="m-0 text-balance font-bold tracking-tight text-[var(--v2-text-primary)]" style={{ fontSize: "var(--text-2xl)" }}>
              Start learning trading the right way.
            </p>
            <Link
              to={terminalTo}
              className="mt-6 inline-flex items-center justify-center rounded-[var(--radius-md)] border border-[var(--v2-accent-border)] bg-[var(--v2-accent-soft)] px-6 py-3 text-[length:var(--text-sm)] font-bold uppercase tracking-wide text-[var(--v2-text-accent)] no-underline transition-opacity hover:opacity-90"
            >
              Launch Terminal
            </Link>
          </div>
        </section>
      </main>

      <footer className="border-t border-[var(--v2-border-subtle)] py-8 text-center">
        <p className="m-0 text-[length:var(--text-xs)] text-[var(--v2-text-muted)]">
          Built by Shreyash Jadhav ·{" "}
          <Link to="/creator" className="text-[var(--v2-text-accent)] no-underline hover:underline">
            Creator
          </Link>
        </p>
      </footer>
    </div>
  );
}
