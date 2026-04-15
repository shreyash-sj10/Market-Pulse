import Sidebar from "../Sidebar/Sidebar.jsx";
import Topbar from "../Topbar/Topbar.jsx";

export default function AppLayout({ title, children }) {
  return (
    <div
      style={{
        background: "var(--v2-bg-base)",
        color: "var(--v2-text-primary)",
        display: "flex",
        minHeight: "100vh",
      }}
    >
      <Sidebar />

      <main style={{ display: "flex", flex: 1, flexDirection: "column" }}>
        <Topbar title={title} />
        <section
          style={{
            flex: 1,
            padding: "1.5rem",
          }}
        >
          {children}
        </section>
      </main>
    </div>
  );
}
