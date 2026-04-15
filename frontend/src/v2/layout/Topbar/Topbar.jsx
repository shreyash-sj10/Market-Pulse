import SystemStatus from "../../components/system/SystemStatus.jsx";

export default function Topbar({ title = "V2 Workspace" }) {
  return (
    <header
      style={{
        alignItems: "center",
        background: "var(--v2-bg-section)",
        borderBottom: "1px solid var(--v2-border-subtle)",
        display: "flex",
        justifyContent: "space-between",
        padding: "1rem 1.5rem",
      }}
    >
      <h1
        style={{
          color: "var(--v2-text-primary)",
          fontSize: "1rem",
          fontWeight: 700,
          margin: 0,
        }}
      >
        {title}
      </h1>
      <SystemStatus />
    </header>
  );
}
