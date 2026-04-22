import { Link } from "react-router-dom";
import { useAuth } from "../../../features/auth/useAuth.jsx";
import { ROUTES } from "../../routing/routes";

type PublicNavProps = {
  /** When true, section hash links target the landing page. */
  onCreatorPage?: boolean;
};

export default function PublicNav({ onCreatorPage = false }: PublicNavProps) {
  const { user } = useAuth();
  const terminalTo = user ? ROUTES.dashboard : ROUTES.login;

  const hash = (id: string) => (onCreatorPage ? `/#${id}` : `#${id}`);

  const linkCls =
    "text-[length:var(--text-xs)] font-semibold uppercase tracking-[var(--tracking-wider)] text-[var(--v2-text-secondary)] no-underline border-b border-transparent hover:border-[var(--v2-accent-border)] hover:text-[var(--v2-text-primary)] transition-colors";

  return (
    <header
      className="sticky top-0 z-[var(--z-topbar)] border-b border-[var(--v2-border-subtle)] bg-[color-mix(in_srgb,var(--v2-bg-base)_94%,transparent)] backdrop-blur-md"
      role="banner"
    >
      <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-3 sm:px-6 md:flex-row md:items-center md:justify-between md:gap-6">
        <div className="flex items-center justify-between gap-4">
          <Link
            to="/"
            className="font-black tracking-tight text-[var(--v2-text-primary)] no-underline"
            style={{ fontSize: "var(--text-lg)" }}
          >
            Noesis
          </Link>
          <div className="flex items-center gap-2 md:hidden">
            <Link
              to="/creator"
              className="rounded-[var(--radius-md)] px-2 py-1.5 text-[length:var(--text-2xs)] font-semibold uppercase tracking-wide text-[var(--v2-text-secondary)] no-underline"
            >
              Creator
            </Link>
            <Link
              to={terminalTo}
              className="rounded-[var(--radius-md)] border border-[var(--v2-accent-border)] bg-[var(--v2-accent-soft)] px-2.5 py-1.5 text-[length:var(--text-2xs)] font-bold uppercase tracking-wide text-[var(--v2-text-accent)] no-underline"
            >
              Enter terminal
            </Link>
          </div>
        </div>

        <nav
          className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 md:flex-1"
          aria-label="Site sections"
        >
          <a className={linkCls} href={hash("system-surfaces")}>
            Surfaces
          </a>
          <a className={linkCls} href={hash("system-mechanics")}>
            Pipeline
          </a>
          <a className={linkCls} href={hash("principles")}>
            Principles
          </a>
        </nav>

        <div className="hidden items-center gap-2 md:flex md:shrink-0">
          <Link
            to="/creator"
            className="rounded-[var(--radius-md)] px-3 py-2 text-[length:var(--text-xs)] font-semibold uppercase tracking-wide text-[var(--v2-text-secondary)] no-underline transition-colors hover:text-[var(--v2-text-primary)]"
          >
            Creator
          </Link>
          <Link
            to={terminalTo}
            className="rounded-[var(--radius-md)] border border-[var(--v2-accent-border)] bg-[var(--v2-accent-soft)] px-3 py-2 text-[length:var(--text-xs)] font-bold uppercase tracking-wide text-[var(--v2-text-accent)] no-underline transition-opacity hover:opacity-90"
          >
            Enter terminal
          </Link>
        </div>
      </div>
    </header>
  );
}
