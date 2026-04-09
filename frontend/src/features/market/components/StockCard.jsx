import { useState, memo } from "react";
import { 
  TrendingUp, 
  TrendingDown, 
  Layers, 
  Activity, 
  Zap, 
  ArrowUpRight,
  ShieldCheck,
  Info
} from "lucide-react";
import { motion } from "framer-motion";
import { formatINR } from "../../../utils/currency.utils";
import { useNavigate } from "react-router-dom";

/**
 * STOCK CARD: HIGH-FIDELITY ASSET VIEW
 * Memoized to prevent performance degradation during live price stream events.
 */
const StockCard = memo(({ stock, isOwned, onOpenChart }) => {
  const navigate = useNavigate();
  const [isFlipped, setIsFlipped] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  const isUp = stock.changePercent >= 0;

  const handleTrade = (e) => {
    e.stopPropagation();
    navigate("/trade", { state: { symbol: stock.symbol, type: "BUY" } });
  };

  const handleAnalysis = (e) => {
    e.stopPropagation();
    onOpenChart && onOpenChart();
  };

  const shouldFlip = (isHovered && window.innerWidth >= 1024) || isFlipped;

  return (
    <div 
      className="relative h-[440px] w-full perspective-1000 cursor-pointer"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={() => setIsFlipped(!isFlipped)}
    >
      <motion.div
        className="w-full h-full relative preserve-3d transition-all duration-500"
        initial={false}
        animate={{ rotateY: shouldFlip ? 180 : 0 }}
        transition={{ type: "spring", stiffness: 260, damping: 20 }}
      >
        {/* ── FRONT SIDE (The High-Fidelity Price View) ── */}
        <div className="absolute inset-0 backface-hidden bg-white rounded-[2.5rem] border border-slate-100 shadow-sm flex flex-col p-10 overflow-hidden">
             
             {isOwned && (
                <div className="absolute top-6 right-10 px-3 py-1 bg-indigo-600 text-white text-[8px] font-black uppercase tracking-widest rounded-full shadow-lg shadow-indigo-600/30 z-20">
                  In Portfolio
                </div>
             )}

             <div className="flex justify-between items-start mb-8">
                <div>
                   <h3 className="text-3xl font-black text-slate-900 tracking-tighter">{stock.symbol}</h3>
                   <div className="flex items-center gap-2 mt-2">
                      <span className={`text-[9px] font-bold px-2.5 py-1 rounded-lg uppercase tracking-widest ${stock.trend === 'BULLISH' ? 'bg-emerald-50 text-emerald-600' : stock.trend === 'BEARISH' ? 'bg-rose-50 text-rose-600' : 'bg-slate-50 text-slate-500'}`}>
                         {stock.trend}
                      </span>
                   </div>
                </div>
                <div className={`p-4 rounded-[1.5rem] ${isUp ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                   {isUp ? <TrendingUp size={24} /> : <TrendingDown size={24} />}
                </div>
             </div>

             <div className="mt-auto">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1 block">Live Valuation</span>
                <p className="text-4xl font-black text-slate-900 tracking-tighter mb-2">{formatINR(stock.price, false)}</p>
                <div className={`flex items-center gap-1.5 font-black text-sm ${isUp ? "text-emerald-500" : "text-rose-500"}`}>
                   {isUp ? "+" : ""}{stock.changePercent}%
                   <span className="text-[10px] text-slate-300 font-bold ml-1 uppercase">/ 24h</span>
                </div>
             </div>

             <div className="mt-10 pt-8 border-t border-slate-50 flex items-center justify-between">
                <div className="flex items-center gap-2 text-slate-400">
                   <Zap size={14} className="animate-pulse" />
                   <span className="text-[9px] font-bold uppercase tracking-[0.2em]">Live Registry Node</span>
                </div>
                <div className="p-2 bg-slate-50 rounded-lg text-slate-300">
                   <Info size={14} />
                </div>
             </div>
        </div>

        {/* ── BACK SIDE (Execution & Deep Meta) ── */}
        <div 
          className="absolute inset-0 backface-hidden bg-slate-900 rounded-[2.5rem] border border-white/5 shadow-2xl flex flex-col p-10 rotate-y-180 overflow-hidden text-slate-300"
          onClick={(e) => e.stopPropagation()}
        >
             <div className="flex items-center gap-3 mb-10">
                <div className="p-2.5 bg-white/5 rounded-xl border border-white/10">
                   <Activity size={18} className="text-indigo-400" />
                </div>
                <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">System Trace v1.0</span>
             </div>

             <div className="space-y-6 flex-1">
                {stock.marketCap && (
                  <div className="flex flex-col gap-1">
                     <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2"><Layers size={10}/> Market Capital</span>
                     <span className="text-lg font-black text-white tracking-tight">{(stock.marketCap / 1e12).toFixed(2)}T</span>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-6">
                    {stock.peRatio && (
                      <div className="flex flex-col gap-1">
                         <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2"><Activity size={10}/> P/E Ratio</span>
                         <span className="text-lg font-black text-white underline decoration-indigo-500 underline-offset-4 tracking-tighter">{stock.peRatio}</span>
                      </div>
                    )}
                    <div className="flex flex-col gap-1">
                       <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2"><Zap size={10}/> 24h Volume</span>
                       <span className="text-lg font-black text-white tracking-tighter">{(stock.volume / 1e6).toFixed(1)}M</span>
                    </div>
                </div>
             </div>

             <div className="mt-auto grid grid-cols-2 gap-4">
                <button 
                  onClick={handleTrade}
                  className="group flex items-center justify-center gap-2 py-4 bg-indigo-600 hover:bg-white hover:text-slate-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all shadow-lg shadow-indigo-600/20"
                >
                   Trade <ArrowUpRight size={14} className="group-hover:rotate-45 transition-transform" />
                </button>
                <button 
                  onClick={handleAnalysis}
                  className="flex items-center justify-center gap-2 py-4 bg-white/10 hover:bg-white/20 text-white border border-white/10 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all"
                >
                   Analysis <ShieldCheck size={14} />
                </button>
             </div>
        </div>
      </motion.div>
    </div>
  );
});

export default StockCard;
