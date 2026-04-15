import MarketTickerTape from "./market/MarketTickerTape";
import { useAuth } from "../features/auth/AuthContext";
import { LogOut, LayoutDashboard, User } from "lucide-react";
import { getCurrencyStatus } from "../utils/currency.utils";
import { useMarketTicker } from "../hooks/useMarket";

export default function Navbar() {
  const { user, logout } = useAuth();
  const currencyStatus = getCurrencyStatus();
  const { indices, isLoading } = useMarketTicker();

  return (
    <header className="fixed top-0 left-0 right-0 h-16 bg-white/70 backdrop-blur-lg border-b border-slate-200/60 z-20 flex items-center justify-between px-6 shadow-sm transition-all">
      <div className="flex items-center gap-10">
        <div className="flex items-center gap-3">
          <div className="bg-blue-600 text-white p-2 rounded-lg shadow-blue-500/30 shadow-md">
            <LayoutDashboard size={20} />
          </div>
          <div className="font-extrabold text-xl tracking-tighter text-slate-800">
            Antigravity<span className="text-blue-600">Fin</span>
          </div>
        </div>

        {/* Global Market Awareness Sliding Strip (Centered) */}
        {user && (
          <div className="flex-grow max-w-2xl overflow-hidden mx-10 hidden md:block border-x border-slate-100">
            <MarketTickerTape indices={indices} isLoading={isLoading} />
          </div>
        )}
      </div>

      <div className="flex items-center gap-5">
        {currencyStatus.isFallback && (
          <div className="hidden md:block px-3 py-1 bg-amber-50 border border-amber-100 rounded-full text-[10px] font-black uppercase tracking-widest text-amber-700">
            FX {currencyStatus.source}
          </div>
        )}
        {user ? (
          <>
            <div className="flex items-center gap-3 px-3 py-1.5 bg-slate-50 border border-slate-100 rounded-full shadow-inner">
              <div className="bg-blue-100 text-blue-700 p-1 rounded-full">
                <User size={16} />
              </div>
              <span className="text-sm font-bold text-slate-700 pr-1 select-none">
                {user.name || user.email.split('@')[0] || "Trader"}
              </span>
            </div>
            <button
              onClick={logout}
              className="group flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-red-500 transition-colors"
            >
              <LogOut size={18} className="group-hover:-translate-x-0.5 transition-transform" />
              <span>Sign Out</span>
            </button>
          </>
        ) : null}
      </div>
    </header>
  );
}
