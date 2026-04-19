import { useCallback, useState } from "react";
import { NavLink } from "react-router-dom";
import { useAuth } from "../../../features/auth/AuthContext.jsx";
import { ROUTES } from "../../routing/routes";
import {
  LayoutDashboard,
  BarChart2,
  Briefcase,
  BookOpen,
  User,
  Activity,
  PanelLeft,
} from "lucide-react";

const NAV_ITEMS = [
  { key: "home",      label: "Home",      to: ROUTES.dashboard, icon: LayoutDashboard },
  { key: "markets",   label: "Markets",   to: ROUTES.markets,   icon: BarChart2 },
  { key: "portfolio", label: "Portfolio", to: ROUTES.portfolio, icon: Briefcase },
  { key: "journal",   label: "Journal",   to: ROUTES.journal,   icon: BookOpen },
  { key: "profile",   label: "Profile",   to: ROUTES.profile,   icon: User },
  { key: "trace",     label: "Trace",     to: ROUTES.trace,     icon: Activity },
];

export default function Sidebar() {
  const { user } = useAuth();
  const [hovered, setHovered] = useState(false);
  const [pinned, setPinned] = useState(false);

  const expanded = pinned || hovered;
  const togglePin = useCallback(() => {
    setPinned((p) => !p);
  }, []);

  const displayName  = user?.name ?? user?.email?.split("@")[0] ?? "Operator";
  const initials     = displayName.slice(0, 2).toUpperCase();
  const isConnected  = !!user;
  const statusLabel  = isConnected ? "Connected" : "Offline";
  const appVersion   = import.meta.env.VITE_APP_VERSION ?? "v2";

  return (
    <aside
      className={`sidebar ${expanded ? "sidebar--expanded" : "sidebar--collapsed"}`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div className="sidebar__brand" aria-label={expanded ? undefined : "NOESIS"}>
        <div className="sidebar__logo">{expanded ? "NOESIS" : "N"}</div>
        <div className="sidebar__tagline">Terminal {appVersion}</div>
      </div>

      <nav className="sidebar-nav" aria-label="Main navigation">
        {NAV_ITEMS.map(({ key, label, to, icon: Icon }) => (
          <NavLink
            key={key}
            to={to}
            title={label}
            className={({ isActive }) =>
              isActive ? "sidebar-link is-active" : "sidebar-link"
            }
          >
            <Icon className="sidebar-link__icon" size={16} />
            <span className="sidebar-link__label">{label}</span>
          </NavLink>
        ))}
        <button
          type="button"
          className={`sidebar-rail-toggle ${pinned ? "sidebar-rail-toggle--pinned" : ""}`}
          onClick={togglePin}
          aria-pressed={pinned}
          title={pinned ? "Unpin sidebar (collapse when not hovered)" : "Pin sidebar open"}
        >
          <PanelLeft size={16} aria-hidden />
          <span className="sidebar-rail-toggle__label">{pinned ? "Unpin" : "Pin"}</span>
        </button>
      </nav>

      <div className="sidebar__user">
        <div className="sidebar__avatar" aria-hidden="true">
          {initials}
        </div>
        <div className="sidebar__user-info">
          <div className="sidebar__user-name">{displayName}</div>
          <div className="sidebar__user-status" style={{ color: isConnected ? "var(--v2-state-success)" : "var(--v2-text-muted)" }}>
            {statusLabel}
          </div>
        </div>
      </div>
    </aside>
  );
}
