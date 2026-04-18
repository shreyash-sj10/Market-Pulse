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

  const displayName  = user?.name ?? user?.email?.split("@")[0] ?? "Operator";
  const initials     = displayName.slice(0, 2).toUpperCase();
  const isConnected  = !!user;
  const statusLabel  = isConnected ? "Connected" : "Offline";
  const appVersion   = import.meta.env.VITE_APP_VERSION ?? "v2";

  return (
    <aside className="sidebar">
      <div className="sidebar__brand">
        <div className="sidebar__logo">NOESIS</div>
        <div className="sidebar__tagline">Terminal {appVersion}</div>
      </div>

      <nav className="sidebar-nav" aria-label="Main navigation">
        {NAV_ITEMS.map(({ key, label, to, icon: Icon }) => (
          <NavLink
            key={key}
            to={to}
            className={({ isActive }) =>
              isActive ? "sidebar-link is-active" : "sidebar-link"
            }
          >
            <Icon className="sidebar-link__icon" size={16} />
            <span className="sidebar-link__label">{label}</span>
          </NavLink>
        ))}
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
