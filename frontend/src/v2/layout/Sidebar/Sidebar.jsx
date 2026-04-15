import { NavLink } from "react-router-dom";

const routes = [
  { key: "home", label: "Home", to: "/" },
  { key: "markets", label: "Markets", to: "/markets" },
  { key: "portfolio", label: "Portfolio", to: "/portfolio" },
  { key: "journal", label: "Journal", to: "/journal" },
  { key: "profile", label: "Profile", to: "/profile" },
  { key: "trace", label: "Trace", to: "/trace" },
];

export default function Sidebar() {
  return (
    <aside
      style={{
        background: "var(--v2-bg-section)",
        borderRight: "1px solid var(--v2-border-subtle)",
        display: "flex",
        flexDirection: "column",
        gap: "0.5rem",
        minHeight: "100vh",
        padding: "1rem",
        width: "240px",
      }}
    >
      {routes.map((route) => (
        <NavLink
          key={route.key}
          to={route.to}
          style={({ isActive }) => ({
            background: isActive ? "var(--v2-bg-elevated)" : "transparent",
            border: "1px solid var(--v2-border-subtle)",
            borderRadius: "0.5rem",
            color: "var(--v2-text-primary)",
            display: "block",
            fontSize: "0.875rem",
            fontWeight: 600,
            padding: "0.65rem 0.85rem",
            textDecoration: "none",
          })}
        >
          {route.label}
        </NavLink>
      ))}
    </aside>
  );
}
