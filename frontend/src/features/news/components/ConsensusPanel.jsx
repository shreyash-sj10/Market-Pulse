import { motion } from "framer-motion";
import { TrendingUp, TrendingDown, Minus, Activity, ShieldCheck, Zap, AlertTriangle, ArrowRight, ShieldAlert } from "lucide-react";

/**
 * HYBRID CONSENSUS PANEL (AI ASSISTED, RULE GOVERNED)
 */
export default function ConsensusPanel({ sector, consensus }) {
  if (!consensus) return null;

  const sentimentStyles = {
    BULLISH: { color: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/20", icon: <TrendingUp size={20} /> },
    BEARISH: { color: "text-rose-400", bg: "bg-rose-500/10", border: "border-rose-500/20", icon: <TrendingDown size={20} /> },
    NEUTRAL: { color: "text-slate-400", bg: "bg-slate-500/10", border: "border-slate-500/20", icon: <Minus size={20} /> }
  };

  const verdictStyles = {
    BUY: "bg-emerald-600 text-white shadow-[0_0_15px_rgba(16,185,129,0.4)]",
    WAIT: "bg-slate-700 text-slate-300",
    AVOID: "bg-rose-600 text-white shadow-[0_0_15px_rgba(225,29,72,0.4)]",
    CAUTION: "bg-amber-600 text-white"
  };

  const sent = sentimentStyles[consensus.impact] || sentimentStyles.NEUTRAL;

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      className={`relative overflow-hidden bg-slate-900 border ${sent.border} rounded-[2rem] p-8 shadow-2xl mb-12`}
    >
      <div className="relative z-10 flex flex-col md:flex-row gap-8 items-start justify-between">
        <div className="flex-1 space-y-8 w-full">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
             <div className="flex items-center gap-4">
                <div className={`p-4 ${sent.bg} rounded-2xl border ${sent.border} shadow-inner`}>{sent.icon}</div>
                <div>
                   <h3 className="text-[10px] font-black text-white uppercase tracking-[0.4em]">{sector} HYBRID NODE</h3>
                   <div className="flex items-center gap-2 mt-1">
                      <span className={`text-[10px] font-black ${sent.color} uppercase tracking-widest`}>{consensus.temporal || 'STABLE'}</span>
                      <span className="text-slate-700">•</span>
                      <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Confidence: {consensus.confidence}%</span>
                   </div>
                </div>
             </div>
             
             <div className="flex items-center gap-4 py-3 px-6 bg-black/40 border border-white/5 rounded-2xl">
                <div className="text-right">
                   <div className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">Final Verdict</div>
                   <div className={`px-5 py-1 rounded-full text-[11px] font-black uppercase tracking-[0.2em] ${verdictStyles[consensus.verdict]}`}>
                     {consensus.verdict}
                   </div>
                </div>
                <div className="w-px h-8 bg-white/10" />
                <div className="flex flex-col items-center">
                   <ShieldCheck size={14} className="text-emerald-500 mb-1" />
                   <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest leading-none text-center">Rule<br/>Governed</span>
                </div>
             </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
             <div className="p-6 bg-white/[0.02] border border-white/5 rounded-2xl border-l-4 border-l-indigo-500">
                <div className="flex items-center gap-2 mb-4">
                   <Activity size={12} className="text-indigo-400" />
                   <div className="text-[9px] font-black text-slate-500 uppercase tracking-[0.3em]">AI Dominance Interpretation</div>
                </div>
                <p className="text-sm font-bold text-white leading-relaxed italic">"{consensus.judgment}"</p>
                <div className="mt-4 pt-4 border-t border-white/5 flex flex-wrap items-center gap-4">
                   <div className="flex items-center gap-2">
                       <Zap size={10} className="text-amber-400" />
                       <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">{consensus.mechanism}</span>
                   </div>
                   {consensus.keyDriver && (
                      <div className="flex items-center gap-2 px-2 py-0.5 bg-indigo-500/10 border border-indigo-500/20 rounded">
                         <span className="text-[8px] font-black text-indigo-400 uppercase tracking-widest">Key Driver:</span>
                         <span className="text-[8px] font-black text-white uppercase tracking-widest">{consensus.keyDriver}</span>
                      </div>
                   )}
                </div>
             </div>

             <div className="p-6 bg-black/20 border border-white/5 rounded-2xl">
                <div className="flex items-center gap-2 mb-4">
                   <ShieldAlert size={12} className="text-rose-400" />
                   <div className="text-[9px] font-black text-slate-500 uppercase tracking-[0.3em]">Deterministic Risk Audit</div>
                </div>
                <div className="space-y-3">
                   {consensus.riskWarnings?.length > 0 ? (
                      consensus.riskWarnings.map((warning, idx) => (
                         <div key={idx} className="flex items-center gap-3 py-2 px-3 bg-rose-500/5 border border-rose-500/10 rounded-lg">
                            <div className="w-1 h-1 rounded-full bg-rose-500 animate-pulse" />
                            <span className="text-[10px] font-black text-rose-400 uppercase tracking-widest">{warning}</span>
                         </div>
                      ))
                   ) : (
                      <div className="flex items-center gap-3 py-2 px-3 bg-emerald-500/5 border border-emerald-500/10 rounded-lg">
                         <ShieldCheck size={12} className="text-emerald-500" />
                         <span className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">No Critical Veto Triggers</span>
                      </div>
                   )}
                </div>
             </div>
          </div>
        </div>
      </div>

      <div className="mt-8 pt-6 border-t border-white/5 flex items-center justify-between">
         <div className="flex items-center gap-4">
            <span className="text-[9px] font-black text-slate-600 uppercase tracking-[0.4em]">Hybrid Engine Status: Full Sync Integration</span>
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
         </div>
         <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
                <ShieldCheck size={12} className="text-slate-600" />
                <span className="text-[9px] font-black text-slate-600 uppercase tracking-widest">Audit Integrity: 100%</span>
            </div>
         </div>
      </div>
    </motion.div>
  );
}
