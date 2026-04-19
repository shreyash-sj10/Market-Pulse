import { Code, Link2, Mail, Box, Braces, Wind, Server, Database, Layers, Container, Workflow } from "lucide-react";
import { Link } from "react-router-dom";
import PublicNav from "../public/PublicNav";
import { CREATOR_CONFIG } from "./creator.config";

const iconWrap =
  "flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--radius-md)] border border-[var(--v2-border-subtle)] bg-[var(--v2-bg-elevated)] text-[var(--v2-text-muted)]";

function TechCell({ icon: Icon, label }: { icon: typeof Box; label: string }) {
  return (
    <div className="flex items-center gap-3 rounded-[var(--radius-lg)] border border-[var(--v2-border-subtle)] bg-[var(--v2-bg-card)] px-4 py-3">
      <div className={iconWrap}>
        <Icon size={18} strokeWidth={1.75} aria-hidden />
      </div>
      <span className="font-mono text-[length:var(--text-sm)] text-[var(--v2-text-primary)]">{label}</span>
    </div>
  );
}

export default function CreatorPage() {
  const shell = "min-h-screen bg-[var(--v2-bg-base)] text-[var(--v2-text-primary)]";
  const inner = "mx-auto max-w-3xl px-4 py-20 sm:px-6 sm:py-28";
  const blockText = "m-0 max-w-2xl text-pretty leading-[1.75] text-[var(--v2-text-secondary)]" + " text-[length:var(--text-md)]";

  return (
    <div className={shell}>
      <PublicNav onCreatorPage />

      <main>
        <section className="border-b border-[var(--v2-border-subtle)] bg-[var(--v2-bg-section)]">
          <div className={inner}>
            <p className="m-0 font-mono text-[length:var(--text-2xs)] font-semibold uppercase tracking-[var(--tracking-widest)] text-[var(--v2-text-muted)]">
              Author
            </p>
            <h1 className="mt-4 text-balance font-black tracking-tight text-[var(--v2-text-primary)]" style={{ fontSize: "var(--text-4xl)" }}>
              Built with intent, not hype.
            </h1>
            <p className="mt-5 max-w-2xl text-pretty text-[var(--v2-text-secondary)]" style={{ fontSize: "var(--text-lg)" }}>
              {CREATOR_CONFIG.name} — Full-stack engineer focused on deterministic systems and behavioral intelligence.
            </p>
            <div className="mt-10 flex flex-wrap gap-3">
              <a
                href={CREATOR_CONFIG.githubProfile}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-[var(--radius-md)] border border-[var(--v2-border-strong)] bg-[var(--v2-bg-card)] px-4 py-2.5 text-[length:var(--text-sm)] font-semibold text-[var(--v2-text-primary)] no-underline transition-colors hover:border-[var(--v2-accent-border)]"
              >
                <Code size={18} strokeWidth={1.75} aria-hidden />
                GitHub
              </a>
              <a
                href={CREATOR_CONFIG.linkedIn}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-[var(--radius-md)] border border-[var(--v2-border-strong)] bg-[var(--v2-bg-card)] px-4 py-2.5 text-[length:var(--text-sm)] font-semibold text-[var(--v2-text-primary)] no-underline transition-colors hover:border-[var(--v2-accent-border)]"
              >
                <Link2 size={18} strokeWidth={1.75} aria-hidden />
                LinkedIn
              </a>
            </div>
          </div>
        </section>

        <section>
          <div className={inner}>
            <p className="m-0 font-mono text-[length:var(--text-2xs)] font-semibold uppercase tracking-[var(--tracking-widest)] text-[var(--v2-text-muted)]">
              Philosophy
            </p>
            <p className={`${blockText} mt-8`}>
              I don&apos;t build AI-driven guesswork. I build systems where decisions are explainable, constraints are enforced, and outcomes don&apos;t
              hide flawed processes.
            </p>
          </div>
        </section>

        <section className="border-y border-[var(--v2-border-subtle)] bg-[var(--v2-bg-section)]">
          <div className={inner}>
            <p className="m-0 font-mono text-[length:var(--text-2xs)] font-semibold uppercase tracking-[var(--tracking-widest)] text-[var(--v2-text-muted)]">
              Stack
            </p>
            <h2 className="mt-3 text-[length:var(--text-2xl)] font-bold tracking-tight text-[var(--v2-text-primary)]">Tech stack</h2>

            <div className="mt-10 space-y-10">
              <div>
                <p className="m-0 mb-4 text-[length:var(--text-xs)] font-semibold uppercase tracking-wide text-[var(--v2-text-muted)]">Frontend</p>
                <div className="grid gap-3 sm:grid-cols-3">
                  <TechCell icon={Box} label="React" />
                  <TechCell icon={Braces} label="TypeScript" />
                  <TechCell icon={Wind} label="Tailwind CSS" />
                </div>
              </div>
              <div>
                <p className="m-0 mb-4 text-[length:var(--text-xs)] font-semibold uppercase tracking-wide text-[var(--v2-text-muted)]">Backend</p>
                <div className="grid gap-3 sm:grid-cols-3">
                  <TechCell icon={Server} label="Node.js" />
                </div>
              </div>
              <div>
                <p className="m-0 mb-4 text-[length:var(--text-xs)] font-semibold uppercase tracking-wide text-[var(--v2-text-muted)]">Data</p>
                <div className="grid gap-3 sm:grid-cols-3">
                  <TechCell icon={Database} label="MongoDB" />
                  <TechCell icon={Layers} label="Redis" />
                </div>
              </div>
              <div>
                <p className="m-0 mb-4 text-[length:var(--text-xs)] font-semibold uppercase tracking-wide text-[var(--v2-text-muted)]">Infra</p>
                <div className="grid gap-3 sm:grid-cols-3">
                  <TechCell icon={Container} label="Docker" />
                  <TechCell icon={Workflow} label="GitHub Actions" />
                </div>
              </div>
            </div>
          </div>
        </section>

        <section>
          <div className={inner}>
            <p className="m-0 font-mono text-[length:var(--text-2xs)] font-semibold uppercase tracking-[var(--tracking-widest)] text-[var(--v2-text-muted)]">
              Engineering
            </p>
            <h2 className="mt-3 text-[length:var(--text-2xl)] font-bold tracking-tight text-[var(--v2-text-primary)]">Highlights</h2>
            <ul className="mt-8 space-y-3 text-[length:var(--text-md)] text-[var(--v2-text-secondary)]">
              {[
                "Deterministic decision engine",
                "Constraint-first execution",
                "Idempotent transactions",
                "Behavioral tracking system",
                "Reflection engine",
              ].map((item) => (
                <li key={item} className="flex gap-3">
                  <span className="font-mono text-[var(--v2-text-accent)]">▸</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="border-t border-[var(--v2-border-subtle)] bg-[var(--v2-bg-section)]">
          <div className={inner}>
            <p className="m-0 font-mono text-[length:var(--text-2xs)] font-semibold uppercase tracking-[var(--tracking-widest)] text-[var(--v2-text-muted)]">
              Purpose
            </p>
            <p className={`${blockText} mt-8`}>This project exists to shift trading from outcome obsession to process discipline.</p>
          </div>
        </section>

        <section>
          <div className={`${inner} pb-28`}>
            <p className="m-0 font-mono text-[length:var(--text-2xs)] font-semibold uppercase tracking-[var(--tracking-widest)] text-[var(--v2-text-muted)]">
              Links
            </p>
            <h2 className="mt-3 text-[length:var(--text-2xl)] font-bold tracking-tight text-[var(--v2-text-primary)]">Contact &amp; code</h2>
            <div className="mt-8 flex flex-col gap-4">
              <a
                href={CREATOR_CONFIG.githubRepo}
                target="_blank"
                rel="noreferrer"
                className="inline-flex w-fit items-center gap-2 text-[length:var(--text-md)] font-medium text-[var(--v2-text-accent)] no-underline hover:underline"
              >
                <Code size={18} aria-hidden />
                GitHub repository
              </a>
              <a
                href={CREATOR_CONFIG.linkedIn}
                target="_blank"
                rel="noreferrer"
                className="inline-flex w-fit items-center gap-2 text-[length:var(--text-md)] font-medium text-[var(--v2-text-accent)] no-underline hover:underline"
              >
                <Link2 size={18} aria-hidden />
                LinkedIn
              </a>
              {CREATOR_CONFIG.email ? (
                <a
                  href={`mailto:${CREATOR_CONFIG.email}`}
                  className="inline-flex w-fit items-center gap-2 text-[length:var(--text-md)] font-medium text-[var(--v2-text-accent)] no-underline hover:underline"
                >
                  <Mail size={18} aria-hidden />
                  {CREATOR_CONFIG.email}
                </a>
              ) : null}
            </div>
            <p className="mt-12 text-[length:var(--text-xs)] text-[var(--v2-text-muted)]">
              <Link to="/" className="text-[var(--v2-text-secondary)] no-underline hover:text-[var(--v2-text-accent)]">
                ← Back to product
              </Link>
            </p>
          </div>
        </section>
      </main>
    </div>
  );
}
