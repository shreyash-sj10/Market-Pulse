import {
  Box,
  Brain,
  Braces,
  Code,
  Container,
  Cpu,
  Database,
  Layers,
  Link2,
  Lock,
  Mail,
  RefreshCw,
  Server,
  Shield,
  Sparkles,
  Terminal,
  Wind,
  Workflow,
} from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import { Link } from "react-router-dom";
import PublicNav from "../public/PublicNav";
import { ROUTES } from "../../routing/routes";
import { CREATOR_CONFIG } from "./creator.config";

const iconWrap =
  "flex h-11 w-11 shrink-0 items-center justify-center rounded-[var(--radius-md)] border border-[color-mix(in_srgb,var(--v2-border-subtle)_80%,var(--v2-accent-primary)_20%)] bg-[color-mix(in_srgb,var(--v2-bg-elevated)_90%,black_10%)] text-[var(--v2-text-muted)]";

function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0] + parts[parts.length - 1]![0]).toUpperCase();
}

function TechCell({ icon: Icon, label }: { icon: typeof Box; label: string }) {
  return (
    <motion.div
      whileHover={{ y: -3, transition: { type: "spring", stiffness: 400, damping: 22 } }}
      className="flex items-center gap-3 rounded-[var(--radius-lg)] border border-[var(--v2-border-subtle)] bg-[color-mix(in_srgb,var(--v2-bg-card)_92%,black_8%)] px-4 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]"
    >
      <div className={iconWrap}>
        <Icon size={18} strokeWidth={1.75} aria-hidden />
      </div>
      <span className="font-mono text-[length:var(--text-sm)] text-[var(--v2-text-primary)]">{label}</span>
    </motion.div>
  );
}

function AmbientMesh({ reduced }: { reduced: boolean }) {
  if (reduced) {
    return (
      <div
        className="pointer-events-none absolute inset-0 opacity-40"
        style={{
          background:
            "radial-gradient(ellipse 80% 50% at 20% 0%, color-mix(in srgb, var(--v2-accent-primary) 14%, transparent), transparent 55%)",
        }}
        aria-hidden
      />
    );
  }
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      <motion.div
        className="absolute -left-[30%] top-[-20%] h-[85%] w-[75%] rounded-full opacity-[0.22]"
        style={{
          background:
            "radial-gradient(ellipse closest-side, color-mix(in srgb, var(--v2-accent-primary) 22%, transparent), transparent 100%)",
        }}
        animate={{ x: [0, 24, 0], y: [0, 18, 0], scale: [1, 1.05, 1] }}
        transition={{ duration: 18, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute -right-[25%] bottom-[-30%] h-[90%] w-[70%] rounded-full opacity-[0.14]"
        style={{
          background:
            "radial-gradient(ellipse closest-side, color-mix(in srgb, var(--v2-accent-primary) 14%, transparent), transparent 100%)",
        }}
        animate={{ x: [0, -30, 0], y: [0, -22, 0], scale: [1, 1.08, 1] }}
        transition={{ duration: 22, repeat: Infinity, ease: "easeInOut" }}
      />
      <div
        className="absolute inset-0 opacity-[0.06]"
        style={{
          backgroundImage: `
            linear-gradient(color-mix(in srgb, var(--v2-text-primary) 14%, transparent) 1px, transparent 1px),
            linear-gradient(90deg, color-mix(in srgb, var(--v2-text-primary) 14%, transparent) 1px, transparent 1px)
          `,
          backgroundSize: "48px 48px",
        }}
      />
    </div>
  );
}

function AuthorHeroVisual({ reduced }: { reduced: boolean }) {
  const url = CREATOR_CONFIG.portraitUrl;
  const initials = initialsFromName(CREATOR_CONFIG.name);

  if (url) {
    return (
      <motion.div
        initial={reduced ? false : { opacity: 0, scale: 0.94, rotate: -1 }}
        animate={{ opacity: 1, scale: 1, rotate: 0 }}
        transition={{ type: "spring", stiffness: 260, damping: 24, delay: reduced ? 0 : 0.15 }}
        className="relative mx-auto w-full max-w-[min(100%,420px)]"
      >
        <div
          className="absolute -inset-3 rounded-[2rem] opacity-70 blur-2xl"
          style={{
            background:
              "linear-gradient(135deg, color-mix(in srgb, var(--v2-accent-primary) 45%, transparent), color-mix(in srgb, var(--v2-accent-primary) 8%, transparent))",
          }}
          aria-hidden
        />
        <div className="relative overflow-hidden rounded-[1.75rem] border border-[color-mix(in_srgb,var(--v2-accent-primary)_35%,var(--v2-border-subtle))] bg-[var(--v2-bg-card)] shadow-[0_0_0_1px_color-mix(in_srgb,var(--v2-accent-primary)_12%,transparent),0_32px_80px_-32px_color-mix(in_srgb,var(--v2-accent-primary)_45%,transparent)]">
          <img src={url} alt={CREATOR_CONFIG.name} className="aspect-[4/5] w-full object-cover" loading="eager" />
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[color-mix(in_srgb,black_55%,transparent)] via-transparent to-transparent" />
          <div className="absolute bottom-4 left-4 right-4 flex items-end justify-between gap-3">
            <p className="m-0 font-mono text-[length:var(--text-2xs)] font-semibold uppercase tracking-[var(--tracking-widest)] text-white/80">
              Author signal
            </p>
            <Terminal className="h-5 w-5 text-white/50" aria-hidden />
          </div>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={reduced ? false : { opacity: 0, scale: 0.92 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ type: "spring", stiffness: 280, damping: 22, delay: reduced ? 0 : 0.12 }}
      className="relative mx-auto w-full max-w-[min(100%,380px)]"
    >
      <motion.div
        className="absolute inset-0 rounded-[2rem] opacity-60 blur-3xl"
        style={{
          background:
            "conic-gradient(from 120deg, color-mix(in srgb, var(--v2-accent-primary) 55%, transparent), transparent, color-mix(in srgb, var(--v2-accent-primary) 35%, transparent))",
        }}
        animate={reduced ? undefined : { rotate: 360 }}
        transition={reduced ? undefined : { duration: 28, repeat: Infinity, ease: "linear" }}
        aria-hidden
      />
      <div className="relative flex aspect-square w-full items-center justify-center overflow-hidden rounded-[2rem] border border-[color-mix(in_srgb,var(--v2-accent-primary)_40%,var(--v2-border-subtle))] bg-[color-mix(in_srgb,var(--v2-bg-card)_88%,black_12%)] shadow-[0_0_0_1px_color-mix(in_srgb,var(--v2-accent-primary)_15%,transparent),0_40px_100px_-40px_color-mix(in_srgb,var(--v2-accent-primary)_50%,transparent)]">
        {!reduced ? (
          <>
            <motion.span
              className="pointer-events-none absolute inset-6 rounded-[1.5rem] border border-[color-mix(in_srgb,var(--v2-accent-primary)_25%,transparent)]"
              animate={{ opacity: [0.35, 0.85, 0.35], scale: [1, 1.02, 1] }}
              transition={{ duration: 5.5, repeat: Infinity, ease: "easeInOut" }}
              aria-hidden
            />
            <motion.span
              className="pointer-events-none absolute inset-10 rounded-[1.25rem] border border-[color-mix(in_srgb,var(--v2-accent-primary)_15%,transparent)]"
              animate={{ opacity: [0.2, 0.55, 0.2] }}
              transition={{ duration: 4.2, repeat: Infinity, ease: "easeInOut", delay: 0.4 }}
              aria-hidden
            />
          </>
        ) : null}
        <div className="relative z-10 flex flex-col items-center gap-2 text-center">
          <span className="font-mono text-[length:var(--text-2xs)] font-semibold uppercase tracking-[var(--tracking-widest)] text-[var(--v2-text-muted)]">
            Identity hash
          </span>
          <span
            className="select-none bg-gradient-to-br from-[var(--v2-text-primary)] to-[var(--v2-text-accent)] bg-clip-text font-black tracking-tight text-transparent"
            style={{ fontSize: "clamp(3.5rem, 14vw, 6.5rem)" }}
          >
            {initials}
          </span>
          <span className="max-w-[14rem] font-mono text-[length:var(--text-2xs)] leading-relaxed text-[var(--v2-text-muted)]">
            Drop a portrait via <span className="text-[var(--v2-text-accent)]">VITE_CREATOR_PORTRAIT</span>
          </span>
        </div>
      </div>
    </motion.div>
  );
}

const signalBadges = ["Deterministic", "Constraint-first", "Audit-safe", "Human-in-the-loop"] as const;

export default function CreatorPage() {
  const reduced = useReducedMotion();
  const inner = "mx-auto max-w-6xl px-4 sm:px-6";
  const blockText =
    "m-0 max-w-2xl text-pretty leading-[1.75] text-[var(--v2-text-secondary)] text-[length:var(--text-md)]";

  const heroEase = [0.22, 1, 0.36, 1] as const;
  const heroChild = {
    hidden: { opacity: 0, y: reduced ? 0 : 26 },
    show: {
      opacity: 1,
      y: 0,
      transition: { duration: reduced ? 0 : 0.55, ease: heroEase },
    },
  };
  const heroContainer = {
    hidden: {},
    show: {
      transition: { staggerChildren: reduced ? 0 : 0.1, delayChildren: reduced ? 0 : 0.06 },
    },
  };

  const sectionReveal = {
    hidden: { opacity: 0, y: reduced ? 0 : 32 },
    show: {
      opacity: 1,
      y: 0,
      transition: { duration: reduced ? 0 : 0.55, ease: heroEase },
    },
  };

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-[var(--v2-bg-base)] text-[var(--v2-text-primary)]">
      <AmbientMesh reduced={reduced} />
      <div className="relative z-10">
        <PublicNav onCreatorPage />

        <main>
          {/* Hero */}
          <section className="relative border-b border-[var(--v2-border-subtle)]">
            <div className={`${inner} flex min-h-[min(88vh,820px)] flex-col justify-center py-16 sm:py-20 lg:py-24`}>
              <div className="grid items-center gap-14 lg:grid-cols-[minmax(0,1.15fr)_minmax(280px,0.95fr)] lg:gap-16">
                <motion.div variants={heroContainer} initial="hidden" animate="show">
                  <motion.p
                    variants={heroChild}
                    className="m-0 inline-flex items-center gap-2 rounded-full border border-[color-mix(in_srgb,var(--v2-accent-primary)_35%,var(--v2-border-subtle))] bg-[color-mix(in_srgb,var(--v2-bg-card)_75%,transparent)] px-3 py-1 font-mono text-[length:var(--text-2xs)] font-semibold uppercase tracking-[var(--tracking-widest)] text-[var(--v2-text-muted)]"
                  >
                    <Sparkles className="h-3.5 w-3.5 text-[var(--v2-text-accent)]" aria-hidden />
                    Creator · NOESIS
                  </motion.p>
                  <motion.h1
                    variants={heroChild}
                    className="mt-6 text-balance font-black leading-[1.05] tracking-tight text-[var(--v2-text-primary)]"
                    style={{ fontSize: "clamp(2.25rem, 5vw, 3.75rem)" }}
                  >
                    Systems that refuse
                    <br />
                    <span className="bg-gradient-to-r from-[var(--v2-text-primary)] via-[var(--v2-text-accent)] to-[color-mix(in_srgb,var(--v2-accent-primary)_75%,var(--v2-text-primary)_25%)] bg-clip-text text-transparent">
                      sloppy decisions.
                    </span>
                  </motion.h1>
                  <motion.p
                    variants={heroChild}
                    className="mt-4 text-[length:var(--text-xl)] font-semibold tracking-tight text-[var(--v2-text-primary)]"
                  >
                    {CREATOR_CONFIG.name}
                  </motion.p>
                  <motion.p variants={heroChild} className="mt-2 max-w-xl text-pretty text-[var(--v2-text-secondary)]" style={{ fontSize: "var(--text-md)" }}>
                    {CREATOR_CONFIG.roleLine}
                  </motion.p>
                  <motion.div variants={heroChild} className="mt-8 flex flex-wrap gap-3">
                    <a
                      href={CREATOR_CONFIG.githubProfile}
                      target="_blank"
                      rel="noreferrer"
                      className="group inline-flex items-center gap-2 rounded-[var(--radius-md)] border border-[var(--v2-accent-border)] bg-[var(--v2-accent-primary)] px-5 py-2.5 text-[length:var(--text-sm)] font-bold uppercase tracking-wide text-[var(--v2-text-inverse)] no-underline transition-[transform,box-shadow] hover:shadow-[0_0_24px_-4px_color-mix(in_srgb,var(--v2-accent-primary)_55%,transparent)]"
                    >
                      <Code size={18} strokeWidth={1.75} aria-hidden className="transition-transform group-hover:scale-110" />
                      GitHub
                    </a>
                    <a
                      href={CREATOR_CONFIG.linkedIn}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-2 rounded-[var(--radius-md)] border border-[var(--v2-border-strong)] bg-[color-mix(in_srgb,var(--v2-bg-card)_88%,black_12%)] px-5 py-2.5 text-[length:var(--text-sm)] font-semibold text-[var(--v2-text-primary)] no-underline transition-colors hover:border-[var(--v2-accent-border)]"
                    >
                      <Link2 size={18} strokeWidth={1.75} aria-hidden />
                      LinkedIn
                    </a>
                    {CREATOR_CONFIG.email ? (
                      <a
                        href={`mailto:${CREATOR_CONFIG.email}`}
                        className="inline-flex items-center gap-2 rounded-[var(--radius-md)] border border-[var(--v2-border-strong)] bg-[color-mix(in_srgb,var(--v2-bg-card)_88%,black_12%)] px-5 py-2.5 text-[length:var(--text-sm)] font-semibold text-[var(--v2-text-primary)] no-underline transition-colors hover:border-[var(--v2-accent-border)]"
                      >
                        <Mail size={18} strokeWidth={1.75} aria-hidden />
                        Email
                      </a>
                    ) : null}
                  </motion.div>
                  <motion.div variants={heroChild} className="mt-10 flex flex-wrap gap-2">
                    {signalBadges.map((b) => (
                      <span
                        key={b}
                        className="rounded-md border border-[var(--v2-border-subtle)] bg-[color-mix(in_srgb,var(--v2-bg-section)_80%,transparent)] px-2.5 py-1 font-mono text-[length:var(--text-2xs)] font-semibold uppercase tracking-wide text-[var(--v2-text-muted)]"
                      >
                        {b}
                      </span>
                    ))}
                  </motion.div>
                  <motion.p variants={heroChild} className="mt-8">
                    <Link
                      to={ROUTES.landing}
                      className="inline-flex items-center gap-2 font-mono text-[length:var(--text-xs)] font-medium text-[var(--v2-text-accent)] no-underline transition-colors hover:text-[var(--v2-text-primary)]"
                    >
                      <Terminal className="h-4 w-4" aria-hidden />
                      ← Back to system surface
                    </Link>
                  </motion.p>
                </motion.div>

                <AuthorHeroVisual reduced={reduced} />
              </div>
            </div>
          </section>

          {/* Philosophy */}
          <section className="relative py-20 sm:py-24">
            <div className={inner}>
              <motion.div
                variants={sectionReveal}
                initial="hidden"
                whileInView="show"
                viewport={{ once: true, amount: 0.25 }}
              >
                <p className="m-0 font-mono text-[length:var(--text-2xs)] font-semibold uppercase tracking-[var(--tracking-widest)] text-[var(--v2-text-muted)]">
                  Philosophy
                </p>
                <blockquote
                  className="mt-8 max-w-4xl border-l-2 border-[color-mix(in_srgb,var(--v2-accent-primary)_55%,var(--v2-border-subtle))] pl-6 text-balance font-semibold leading-snug text-[var(--v2-text-primary)]"
                  style={{ fontSize: "clamp(1.35rem, 3.2vw, 2rem)" }}
                >
                  I don&apos;t ship black-box “AI alpha.” I ship{" "}
                  <span className="text-[var(--v2-text-accent)]">legible judgment</span> — constraints you can defend,
                  traces you can replay, and discipline you can audit when the chart stops flattering you.
                </blockquote>
                <p className={`${blockText} mt-8`}>
                  NOESIS is the exercise: force intent before risk, verdict before execution, reflection after closure. If
                  the process is fragile, the system should say so loudly — not after the loss, before the click.
                </p>
              </motion.div>
            </div>
          </section>

          {/* Stack bento */}
          <section className="relative border-y border-[var(--v2-border-subtle)] bg-[color-mix(in_srgb,var(--v2-bg-section)_92%,black_8%)] py-20 sm:py-24">
            <div className={inner}>
              <motion.div
                variants={sectionReveal}
                initial="hidden"
                whileInView="show"
                viewport={{ once: true, amount: 0.2 }}
              >
                <div className="flex flex-wrap items-end justify-between gap-4">
                  <div>
                    <p className="m-0 font-mono text-[length:var(--text-2xs)] font-semibold uppercase tracking-[var(--tracking-widest)] text-[var(--v2-text-muted)]">
                      Instrumentation
                    </p>
                    <h2 className="mt-3 text-[length:var(--text-2xl)] font-bold tracking-tight text-[var(--v2-text-primary)]">
                      Stack &amp; runtime
                    </h2>
                    <p className="mt-2 max-w-xl text-pretty text-[length:var(--text-sm)] text-[var(--v2-text-secondary)]">
                      Opinionated choices in service of observability: typed surfaces, predictable builds, and infra you can
                      reproduce.
                    </p>
                  </div>
                  <div className="hidden items-center gap-2 rounded-[var(--radius-md)] border border-[var(--v2-border-subtle)] bg-[var(--v2-bg-card)] px-3 py-2 font-mono text-[length:var(--text-2xs)] uppercase tracking-wide text-[var(--v2-text-muted)] sm:flex">
                    <Cpu className="h-4 w-4 text-[var(--v2-text-accent)]" aria-hidden />
                    Production-shaped
                  </div>
                </div>

                <div className="mt-12 space-y-10">
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
              </motion.div>
            </div>
          </section>

          {/* Highlights */}
          <section className="relative py-20 sm:py-24">
            <div className={inner}>
              <motion.div
                variants={sectionReveal}
                initial="hidden"
                whileInView="show"
                viewport={{ once: true, amount: 0.2 }}
              >
                <p className="m-0 font-mono text-[length:var(--text-2xs)] font-semibold uppercase tracking-[var(--tracking-widest)] text-[var(--v2-text-muted)]">
                  Engineering
                </p>
                <h2 className="mt-3 text-[length:var(--text-2xl)] font-bold tracking-tight text-[var(--v2-text-primary)]">
                  What this codebase proves
                </h2>
                <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
                  {[
                    {
                      t: "Deterministic decision engine",
                      d: "Same snapshot + rules → same gate outcome. No lottery in the risk path.",
                      icon: Shield,
                    },
                    {
                      t: "Constraint-first execution",
                      d: "Brackets, policy, and posture checks sit ahead of the order — not in a footnote.",
                      icon: Lock,
                    },
                    {
                      t: "Idempotent transactions",
                      d: "Keys and retries that won’t duplicate your book when the network flinches.",
                      icon: RefreshCw,
                    },
                    {
                      t: "Behavioral tracking",
                      d: "State and history that change what you’re allowed to do next — with receipts.",
                      icon: Brain,
                    },
                    {
                      t: "Reflection engine",
                      d: "Journal, weekly discipline, trace — closure binds intent to outcome.",
                      icon: Terminal,
                    },
                  ].map((item, idx) => {
                    const HiIcon = item.icon;
                    return (
                    <motion.div
                      key={item.t}
                      initial={reduced ? false : { opacity: 0, y: 18 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true, amount: 0.2 }}
                      transition={{ delay: reduced ? 0 : idx * 0.06, duration: reduced ? 0 : 0.45, ease: heroEase }}
                      whileHover={
                        reduced
                          ? undefined
                          : {
                              y: -4,
                              boxShadow: "0 0 0 1px color-mix(in srgb, var(--v2-accent-primary) 28%, transparent), 0 24px 48px -24px color-mix(in srgb, var(--v2-accent-primary) 35%, transparent)",
                            }
                      }
                      className="rounded-[var(--radius-lg)] border border-[var(--v2-border-subtle)] bg-[color-mix(in_srgb,var(--v2-bg-card)_92%,black_8%)] p-5 transition-colors hover:border-[color-mix(in_srgb,var(--v2-accent-primary)_35%,var(--v2-border-subtle))]"
                    >
                      <HiIcon className="h-5 w-5 text-[var(--v2-text-accent)]" aria-hidden />
                      <h3 className="mt-3 text-[length:var(--text-sm)] font-bold text-[var(--v2-text-primary)]">{item.t}</h3>
                      <p className="mt-2 mb-0 text-[length:var(--text-xs)] leading-relaxed text-[var(--v2-text-muted)]">{item.d}</p>
                    </motion.div>
                    );
                  })}
                </div>
              </motion.div>
            </div>
          </section>

          {/* Purpose + links */}
          <section className="relative border-t border-[var(--v2-border-subtle)] bg-[color-mix(in_srgb,var(--v2-bg-section)_88%,black_12%)] py-20 sm:py-24">
            <div className={`${inner} pb-24`}>
              <motion.div
                variants={sectionReveal}
                initial="hidden"
                whileInView="show"
                viewport={{ once: true, amount: 0.25 }}
                className="grid gap-12 lg:grid-cols-[1fr_minmax(260px,0.9fr)] lg:items-start"
              >
                <div>
                  <p className="m-0 font-mono text-[length:var(--text-2xs)] font-semibold uppercase tracking-[var(--tracking-widest)] text-[var(--v2-text-muted)]">
                    Purpose
                  </p>
                  <h2 className="mt-3 text-[length:var(--text-2xl)] font-bold tracking-tight text-[var(--v2-text-primary)]">
                    Why this exists
                  </h2>
                  <p className={`${blockText} mt-6`}>
                    To drag trading culture away from outcome porn and toward{" "}
                    <strong className="font-semibold text-[var(--v2-text-primary)]">process evidence</strong> — the
                    boring stuff that keeps you solvent when variance turns cruel.
                  </p>
                </div>
                <div className="rounded-[var(--radius-lg)] border border-[color-mix(in_srgb,var(--v2-accent-primary)_22%,var(--v2-border-subtle))] bg-[color-mix(in_srgb,var(--v2-bg-card)_90%,black_10%)] p-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
                  <p className="m-0 font-mono text-[length:var(--text-2xs)] font-semibold uppercase tracking-[var(--tracking-widest)] text-[var(--v2-text-muted)]">
                    Contact &amp; code
                  </p>
                  <div className="mt-6 flex flex-col gap-4">
                    <a
                      href={CREATOR_CONFIG.githubRepo}
                      target="_blank"
                      rel="noreferrer"
                      className="group inline-flex w-fit items-center gap-2 text-[length:var(--text-md)] font-medium text-[var(--v2-text-accent)] no-underline"
                    >
                      <Code size={18} aria-hidden className="transition-transform group-hover:translate-x-0.5" />
                      <span className="border-b border-transparent group-hover:border-[var(--v2-text-accent)]">GitHub repository</span>
                    </a>
                    <a
                      href={CREATOR_CONFIG.linkedIn}
                      target="_blank"
                      rel="noreferrer"
                      className="group inline-flex w-fit items-center gap-2 text-[length:var(--text-md)] font-medium text-[var(--v2-text-accent)] no-underline"
                    >
                      <Link2 size={18} aria-hidden className="transition-transform group-hover:translate-x-0.5" />
                      <span className="border-b border-transparent group-hover:border-[var(--v2-text-accent)]">LinkedIn</span>
                    </a>
                    {CREATOR_CONFIG.email ? (
                      <a
                        href={`mailto:${CREATOR_CONFIG.email}`}
                        className="group inline-flex w-fit items-center gap-2 text-[length:var(--text-md)] font-medium text-[var(--v2-text-accent)] no-underline"
                      >
                        <Mail size={18} aria-hidden className="transition-transform group-hover:translate-x-0.5" />
                        <span className="border-b border-transparent group-hover:border-[var(--v2-text-accent)]">{CREATOR_CONFIG.email}</span>
                      </a>
                    ) : null}
                  </div>
                </div>
              </motion.div>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}
