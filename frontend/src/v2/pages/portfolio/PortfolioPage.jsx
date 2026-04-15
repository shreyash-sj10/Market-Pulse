import AppLayout from "../../layout/AppLayout/AppLayout.jsx";
import ContextPanel from "../../components/context/ContextPanel.jsx";
import DecisionBadge from "../../components/decision/DecisionBadge.jsx";
import TradeFeatureShell from "../../features/trade/TradeFeatureShell.jsx";

export default function PortfolioPage() {
  return (
    <AppLayout title="Portfolio">
      <div style={{ display: "grid", gap: "1rem" }}>
        <DecisionBadge />
        <ContextPanel />
        <TradeFeatureShell />
      </div>
    </AppLayout>
  );
}
