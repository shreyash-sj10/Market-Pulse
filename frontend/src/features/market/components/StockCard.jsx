import { memo, useState } from "react";
import {
  Activity,
  ArrowUpRight,
  BarChart3,
  ChartCandlestick,
  Landmark,
  TrendingDown,
  TrendingUp,
  X,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { formatINR } from "../../../utils/currency.utils";

const getCapCategory = (marketCap) => {
  if (!marketCap) return { label: "Unknown", color: "bg-slate-100 text-slate-500", border: "border-slate-200", dot: "bg-slate-400" };
  const cr = marketCap / 10000000;
  if (cr >= 20000) return { label: "Large Cap", color: "bg-indigo-50 text-indigo-600", border: "border-indigo-100", dot: "bg-indigo-500" };
  if (cr >= 5000) return { label: "Mid Cap", color: "bg-emerald-50 text-emerald-600", border: "border-emerald-100", dot: "bg-emerald-500" };
  return { label: "Small Cap", color: "bg-amber-50 text-amber-600", border: "border-amber-100", dot: "bg-amber-500" };
};

const StockCard = memo(({ stock, isOwned, onOpenChart }) => {
  const navigate = useNavigate();
  const [isFlipped, setIsFlipped] = useState(false);

  const isUp = (stock?.changePercent || 0) >= 0;
  const trendLabel = stock?.trend || (isUp ? "BULLISH" : "BEARISH");
  const capInfo = getCapCategory(stock.marketCap);

  const handleTrade = (e) => {
    e.stopPropagation();
    navigate("/trade", { state: { symbol: stock.symbol, side: "BUY" } });
  };

  const handleOpenChart = (e) => {
    e.stopPropagation();
    onOpenChart?.();
  };

  const toggleFlip = (e) => {
    e.stopPropagation();
    setIsFlipped(!isFlipped);
  };

  return (
    <div
      className="relative h-[410px] w-full flex flex-col group overflow-visible transition-all duration-500 hover:-translate-y-2"
      style={{ perspective: "2000px" }}
    >
      {/* Flippable Top Section (~80%) */}
      <div 
        className="relative flex-grow transition-all duration-700 cubic-bezier(0.4, 0, 0.2, 1)"
        style={{
          transformStyle: "preserve-3d",
          transform: isFlipped ? "rotateY(180deg)" : "rotateY(0deg)",
        }}
      >
        {/* Front Face */}
        <div
          className="absolute inset-0 rounded-t-[2rem] border border-slate-200 border-b-0 bg-white p-6 shadow-sm flex flex-col"
          style={{ backfaceVisibility: "hidden", WebkitBackfaceVisibility: "hidden" }}
        >
          {isOwned && (
            <div className="absolute right-6 top-6 z-10 rounded-full bg-indigo-600/90 backdrop-blur-md px-3 py-1 text-[9px] font-black uppercase tracking-wider text-white shadow-lg shadow-indigo-200">
              In Portfolio
            </div>
          )}

          <div className="flex justify-between items-start mb-6">
            <div className="space-y-1">
              <h3 className="text-3xl font-black uppercase tracking-tight text-slate-900 group-hover:text-indigo-600 transition-colors">
                {stock.symbol}
              </h3>
              <div className="flex items-center gap-2">
                <span className={`flex items-center gap-1.5 rounded-lg px-2 py-1 text-[9px] font-black uppercase tracking-wide border ${capInfo.color} ${capInfo.border}`}>
                  <span className={`w-1 h-1 rounded-full ${capInfo.dot}`} />
                  {capInfo.label}
                </span>
                <span className="text-[10px] font-bold uppercase tracking-wide text-slate-400">NSE Live</span>
                {(stock.isSynthetic || stock.isFallback) && (
                  <span className="text-[9px] font-black uppercase tracking-wide text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-2 py-1">
                    {stock.isSynthetic ? "Synthetic" : "Fallback"}
                  </span>
                )}
              </div>
            </div>

            <div className="flex flex-col items-end gap-3">
              <div className={`rounded-2xl p-3 shadow-sm ${isUp ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600"}`}>
                {isUp ? <TrendingUp size={22} /> : <TrendingDown size={22} />}
              </div>
              <button 
                onClick={toggleFlip}
                className="w-10 h-10 flex items-center justify-center rounded-xl bg-slate-50 text-slate-400 hover:bg-white hover:text-indigo-600 hover:shadow-md hover:border-indigo-100 transition-all border border-slate-100 group/info"
                title="View Security Details"
              >
                <Activity size={18} className="group-hover/info:rotate-12 transition-transform" />
              </button>
            </div>
          </div>

          <div className="mb-6">
            <span className="mb-2 block text-[10px] font-black uppercase tracking-widest text-slate-400">Current Valuation</span>
            <div className="flex items-baseline gap-3">
              <p className="text-4xl font-black tracking-tighter text-slate-900">{formatINR(stock.pricePaise)}</p>
              <div className={`flex items-center gap-1 text-sm font-black ${isUp ? "text-emerald-500" : "text-rose-500"}`}>
                {isUp ? "+" : ""}
                {Number(stock.changePercent || 0).toFixed(2)}%
                <ArrowUpRight size={14} className={isUp ? "animate-bounce-subtle" : "rotate-90"} />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 mb-auto">
            <div className={`rounded-2xl border border-slate-100 bg-slate-50/50 p-4 transition-colors hover:bg-slate-50 relative overflow-hidden group/cap`}>
              <div className="mb-1 text-[9px] font-black uppercase tracking-wider text-slate-400">Trend</div>
              <div className={`text-[11px] font-black ${isUp ? 'text-emerald-600' : 'text-rose-600'}`}>{trendLabel}</div>
            </div>
            <div className="rounded-2xl border border-slate-100 bg-slate-50/50 p-4 transition-colors hover:bg-slate-50">
              <div className="mb-1 text-[9px] font-black uppercase tracking-wider text-slate-400">P/E Ratio</div>
              <div className="text-[11px] font-black text-slate-700">{stock.peRatio || "N/A"}</div>
            </div>
          </div>
        </div>

        {/* Back Face (Glassmorphism) */}
        <div
          className="absolute inset-0 rounded-t-[2rem] border border-slate-700 border-b-0 bg-slate-900 p-6 text-slate-200 shadow-2xl flex flex-col overflow-hidden"
          style={{
            transform: "rotateY(180deg)",
            backfaceVisibility: "hidden",
            WebkitBackfaceVisibility: "hidden",
          }}
        >
          {/* Decorative Gradient Background */}
          <div className="absolute -top-24 -right-24 w-48 h-48 bg-indigo-600/20 blur-[80px] rounded-full" />
          <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-emerald-600/10 blur-[80px] rounded-full" />

          <div className="relative mb-6 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="rounded-xl border border-white/10 bg-white/10 p-2.5 backdrop-blur-md">
                <BarChart3 size={18} className="text-blue-400" />
              </div>
              <div>
                <span className="block text-[10px] font-black uppercase tracking-[0.25em] text-slate-400">Analysis Snapshot</span>
                <span className={`text-[9px] font-bold uppercase tracking-widest ${capInfo.label === 'Large Cap' ? 'text-indigo-400' : capInfo.label === 'Mid Cap' ? 'text-emerald-400' : 'text-amber-400'}`}>
                  {capInfo.label} Security
                </span>
              </div>
            </div>
            <button 
              onClick={toggleFlip}
              className="p-2 rounded-xl bg-white/5 text-slate-400 hover:bg-white/10 hover:text-white transition-all border border-white/10 backdrop-blur-md"
            >
              <X size={18} />
            </button>
          </div>

          <div className="relative mb-6 grid grid-cols-2 gap-4">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-sm">
              <div className="mb-1.5 flex items-center gap-1.5 text-[9px] font-black uppercase tracking-wider text-slate-400">
                <Activity size={12} className="text-white/40" />
                Volume
              </div>
              <div className="text-sm font-black text-white">{(stock.volume || 0).toLocaleString()}</div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-sm">
              <div className="mb-1.5 flex items-center gap-1.5 text-[9px] font-black uppercase tracking-wider text-slate-400">
                <Landmark size={12} className="text-white/40" />
                MCap
              </div>
              <div className="text-[11px] font-black text-white truncate">{stock.marketCap ? formatINR(stock.marketCap) : "N/A"}</div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-sm">
              <div className="mb-1.5 text-[9px] font-black uppercase tracking-wider text-slate-400">PE Spread</div>
              <div className="text-sm font-black text-white">{stock.peRatio || "N/A"}</div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-sm">
              <div className="mb-1.5 text-[9px] font-black uppercase tracking-wider text-slate-400">Momentum</div>
              <div className={`text-sm font-black ${isUp ? "text-emerald-400" : "text-rose-400"}`}>{trendLabel}</div>
            </div>
          </div>

          <div className="relative mt-auto space-y-3 bg-white/5 rounded-2xl p-4 border border-white/5">
             <div className="flex items-center justify-between text-[10px] font-black text-slate-500 uppercase tracking-widest">
                <span>Volatility Profile</span>
                <span className="text-slate-300">MODERATE</span>
             </div>
             <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 w-[65%]" />
             </div>
             <p className="text-[9px] text-slate-500 font-bold leading-relaxed">
               Risk-adjusted returns are stable for the current session.
             </p>
          </div>
        </div>
      </div>

      {/* Static Action Footer (Always Visible) */}
      <div className={`bg-white rounded-b-[2rem] border border-slate-200 border-t-0 p-5 pt-0 transition-all duration-500 ${isFlipped ? 'bg-slate-900 border-slate-700 shadow-2xl overflow-hidden' : ''}`}>
        {/* Continuous border feeling */}
        <div className="pt-4 border-t border-slate-100/10">
          <div className="grid grid-cols-2 gap-4">
            <button
              onClick={handleTrade}
              className="group relative flex items-center justify-center gap-2 rounded-2xl bg-indigo-600 py-3.5 text-[11px] font-black uppercase tracking-widest text-white transition-all hover:bg-indigo-500 shadow-lg shadow-indigo-600/20 active:scale-95 overflow-hidden"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-white/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              Trade <ArrowUpRight size={15} className="transition-transform group-hover:rotate-45" />
            </button>
            <button
              onClick={handleOpenChart}
              className={`flex items-center justify-center gap-2 rounded-2xl py-3.5 text-[11px] font-black uppercase tracking-widest transition-all active:scale-95 ${
                isFlipped
                  ? "bg-slate-800 border border-white/10 text-white hover:bg-slate-700 shadow-lg shadow-slate-900/50"
                  : "bg-slate-50 border border-slate-200 text-slate-700 hover:bg-slate-100 hover:border-slate-300"
              }`}
            >
              Chart <ChartCandlestick size={15} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
});

StockCard.displayName = "StockCard";

export default StockCard;
