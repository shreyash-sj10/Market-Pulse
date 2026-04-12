import { motion } from "framer-motion";
import { TrendingUp, TrendingDown, Minus, ArrowRight, ShieldCheck, Clock } from "lucide-react";

/**
 * SIGNAL NODE — TERMINAL LIST ITEM
 * High signal density, decision-optimized.
 */
export default function SignalNode({ signal, compact = false }) {
  const sentimentStyles = {
    BULLISH: { color: "text-emerald-500", bg: "bg-emerald-500/10", icon: <TrendingUp size={12} /> },
    BEARISH: { color: "text-rose-500", bg: "bg-rose-500/10", icon: <TrendingDown size={12} /> },
    NEUTRAL: { color: "text-slate-400", bg: "bg-slate-500/10", icon: <Minus size={12} /> }
  };

  const verdictStyles = {
    BUY: "border-emerald-500 text-emerald-500",
    WAIT: "border-slate-500 text-slate-500",
    AVOID: "border-rose-500 text-rose-500",
    CAUTION: "border-amber-500 text-amber-500"
  };

  const sent = sentimentStyles[signal.impact] || sentimentStyles.NEUTRAL;

  return (
    <motion.div 
      initial={{ opacity: 0, x: -5 }}
      whileInView={{ opacity: 1, x: 0 }}
      className={`group flex items-start gap-4 p-5 bg-white border-b border-slate-100 last:border-0 hover:bg-slate-50 transition-all`}
    >
      <div className={`p-2 rounded-lg ${sent.bg} ${sent.color} shrink-0 mt-1`}>
        {sent.icon}
      </div>

      <div className="flex-1 space-y-3">
        <div className="flex items-center justify-between">
           <div className="flex items-center gap-3">
              <span className="text-[10px] font-black text-slate-800 uppercase tracking-widest">{signal.symbols?.join(', ')}</span>
              <span className="text-slate-300">•</span>
              <span className={`text-[8px] font-black uppercase tracking-widest ${sent.color}`}>{signal.impact}</span>
              {signal.temporal && (
                 <>
                    <span className="text-slate-300">•</span>
                    <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest italic">{signal.temporal}</span>
                 </>
              )}
           </div>
           <div className="flex items-center gap-3">
              <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1">
                 <Clock size={10} /> {new Date(signal.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
              <span className={`px-2 py-0.5 border rounded text-[8px] font-black uppercase tracking-widest ${verdictStyles[signal.verdict]}`}>
                 {signal.verdict}
              </span>
           </div>
        </div>

        <div className="flex flex-col lg:flex-row lg:items-center gap-4 lg:gap-8">
           <div className="flex-1">
              <h4 className="text-sm font-bold text-slate-900 leading-snug">{signal.event}</h4>
           </div>
           <div className="flex-[1.5] flex items-center gap-4 text-xs font-medium text-slate-500 italic">
              <ArrowRight size={14} className="text-slate-300 shrink-0" />
              <span>{signal.mechanism}</span>
           </div>
           <div className="flex-1 border-l border-slate-200 pl-4 py-1">
              <p className="text-xs font-bold text-indigo-600 leading-relaxed">{signal.judgment}</p>
           </div>
        </div>
      </div>
    </motion.div>
  );
}
