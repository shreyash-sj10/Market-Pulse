import { LogOut } from "lucide-react";
import { useAuth } from "../../../features/auth/AuthContext.jsx";
import { useTickerData } from "../../hooks/useTickerData";
import { usePortfolioSummary } from "../../hooks/usePortfolioSummary";
import { formatINR, fromPaise } from "../../../utils/currency.utils";
import { openDecisionPanel } from "../../trade-flow";
import { useNavigate } from "react-router-dom";
import { ROUTES } from "../../routing/routes";

function TickerBand({ items }) {
  if (!items || items.length === 0) return null;

  // Duplicate the list so the CSS marquee loop is seamless
  const doubled = [...items, ...items];

  return (
    <div className="ticker-band" aria-hidden="true">
      <div className="ticker-band__track">
        {doubled.map((item, i) => {
          const up   = item.changePercent > 0;
          const down = item.changePercent < 0;
          const sign = up ? "+" : "";
          const cls  = up ? "ticker-item__change--up" : down ? "ticker-item__change--down" : "ticker-item__change--flat";
          return (
            <span key={`${item.symbol}-${i}`} className="ticker-item">
              <span className="ticker-item__label">{item.label}</span>
              <span className={`ticker-item__change ${cls}`}>
                {sign}{item.changePercent.toFixed(2)}%
              </span>
              <span className="ticker-item__sep" aria-hidden="true">·</span>
            </span>
          );
        })}
      </div>
    </div>
  );
}

export default function Topbar() {
  const { logout }  = useAuth();
  const { ticker }  = useTickerData();
  const { summary } = usePortfolioSummary();
  const navigate    = useNavigate();

  const balanceRaw = summary?.balancePaise ?? 0;
  const balance    = balanceRaw > 0 ? formatINR(balanceRaw) : "—";

  function handleExecute() {
    navigate(ROUTES.markets);
    setTimeout(() => {
      openDecisionPanel("", {
        decision: { action: "GUIDE", confidence: 0, reason: "" },
        warnings: [],
      });
    }, 100);
  }

  return (
    <header className="topbar">
      {/* ── LEFT: brand ─────────────────────────────────── */}
      <div className="topbar__left">
        <span className="topbar__brand">NOESIS</span>
      </div>

      {/* ── CENTER: 50% animated market ticker ──────────── */}
      <div className="topbar__center">
        <TickerBand items={ticker} />
      </div>

      {/* ── RIGHT: balance + actions ─────────────────────── */}
      <div className="topbar__right">
        <span className="topbar-status" title="Live feed active">
          <span className="topbar-status__dot" aria-hidden="true" />
          <span className="topbar-status__label">LIVE</span>
        </span>
        <span
          className="topbar-balance"
          title="Cash only (withdrawable). Home → Net equity adds the market value of open positions."
        >
          Cash {balance}
        </span>
        <button
          type="button"
          className="topbar-btn-execute"
          onClick={handleExecute}
        >
          + Execute
        </button>
        <button
          type="button"
          className="topbar-btn-icon"
          onClick={logout}
          aria-label="Log out"
          title="Log out"
        >
          <LogOut size={14} />
        </button>
      </div>
    </header>
  );
}
