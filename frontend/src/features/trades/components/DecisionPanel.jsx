import React from 'react';
import { ShieldCheck, Target, Brain, Activity, Globe, X, ArrowRight, ShieldAlert, Sparkles, Terminal } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { formatINR } from '../../../utils/currency.utils';

/**
 * INSTITUTIONAL DECISION PANEL
 * Mandatory 5-layer appraisal before execution authorization.
 */
export default function DecisionPanel({ isOpen, onClose, onConfirm, snapshot, tradeRequest }) {
  if (!isOpen || !snapshot) return null;

  const { market, setup, behavior, risk, verdict } = snapshot;

  const riskStyles = {
    OPTIMAL: { color: "text-emerald-500", bg: "bg-emerald-50", border: "border-emerald-100", btn: "bg-emerald-600 shadow-emerald-200" },
    CAUTION: { color: "text-amber-500", bg: "bg-amber-50", border: "border-amber-100", btn: "bg-amber-600 shadow-amber-200" },
    EXTREME: { color: "text-rose-500", bg: "bg-rose-50", border: "border-rose-100", btn: "bg-rose-600 shadow-rose-200" }
  };

  const style = riskStyles[risk.level] || riskStyles.CAUTION;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[150] flex items-center justify-center p-6 bg-slate-900/80 backdrop-blur-xl">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95, y: 30 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 30 }}
          className="w-full max-w-[900px] bg-white rounded-[3.5rem] shadow-2xl overflow-hidden border border-slate-200 flex flex-col md:flex-row h-auto max-h-[90vh]"
        >
          {/* ── LEFT: INTELLIGENCE LAYERS (60%) ── */}
          <div className="flex-1 p-10 overflow-y-auto custom-scrollbar space-y-8 border-r border-slate-100">
             <header className="flex justify-between items-start mb-4">
                <div>
                   <h2 className="text-2xl font-black text-slate-900 tracking-tight">Executive Decision Audit</h2>
                   <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Protocol: Pre-Execution Authorization Required</p>
                </div>
                <div className={`px-4 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${style.bg} ${style.color}`}>
                   {risk.level} RISK
                </div>
             </header>

             {/* 5-PILLAR INSTITUTIONAL APPRAISAL */}
             <div className="space-y-6">
                <div className="flex items-center gap-3 text-slate-400">
                   <Activity size={16} />
                   <span className="text-[10px] font-black uppercase tracking-widest">Multi-Pillar Decision Audit</span>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                   {Object.entries(snapshot.pillars).map(([key, p]) => (
                      <div key={key} className="p-6 bg-slate-50 rounded-[2.5rem] border border-slate-100 hover:border-indigo-200 transition-all flex flex-col justify-between">
                         <div className="flex justify-between items-start mb-4">
                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{key.replace(/([A-Z])/g, ' $1')}</span>
                            <span className={`px-2 py-0.5 rounded text-[7px] font-black uppercase ${p.score >= 80 ? 'bg-emerald-500 text-white' : p.score >= 60 ? 'bg-amber-500 text-white' : 'bg-rose-500 text-white'}`}>
                               {p.status}
                            </span>
                         </div>
                         <p className="text-[11px] font-bold text-slate-600 leading-relaxed mb-4">
                            {p.reasoning}
                         </p>
                         <div className="h-1 bg-slate-200 rounded-full overflow-hidden">
                            <motion.div 
                               initial={{ width: 0 }} 
                               animate={{ width: `${p.score}%` }} 
                               className={`h-full ${p.score >= 80 ? 'bg-emerald-500' : p.score >= 60 ? 'bg-amber-500' : 'bg-rose-500'}`} 
                            />
                         </div>
                      </div>
                   ))}
                </div>
             </div>
          </div>

          {/* ── RIGHT: FINAL VERDICT (40%) ── */}
          <div className="md:w-[320px] bg-slate-900 p-10 flex flex-col justify-between text-white relative">
             <div className="absolute top-0 right-0 p-8 opacity-5">
                <Terminal size={120} />
             </div>
             
             <div className="relative z-10 space-y-8">
                <div>
                   <span className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.3em] mb-4 block">Final AI Appraisal</span>
                   <h3 className={`text-5xl font-black tracking-tighter ${verdict.finalCall === 'BUY' ? 'text-emerald-400' : verdict.finalCall === 'AVOID' ? 'text-rose-400' : 'text-amber-400'}`}>
                      {verdict.finalCall}
                   </h3>
                   <div className="flex items-center gap-2 mt-2">
                      <div className="h-1 flex-grow bg-white/5 rounded-full overflow-hidden">
                         <div className="h-full bg-emerald-400 transition-all duration-1000" style={{ width: `${verdict.confidence}%` }} />
                      </div>
                      <span className="text-[10px] font-black text-slate-500">{verdict.confidence}%</span>
                   </div>
                </div>

                <div className="p-6 bg-white/5 rounded-3xl border border-white/5 space-y-4">
                   <div className="flex items-center gap-2 text-indigo-300">
                      <ShieldCheck size={14} />
                      <span className="text-[9px] font-black uppercase tracking-widest text-white">CIO Logic Synthesis</span>
                   </div>
                   <p className="text-xs font-medium text-slate-400 leading-relaxed italic">
                      "{verdict.reasoning}"
                   </p>
                </div>

                <div className="space-y-3">
                   <div className="flex justify-between text-[11px] font-bold">
                      <span className="text-slate-500 uppercase tracking-widest">Plan R:R</span>
                      <div className="flex items-center gap-2">
                         <span className="text-white font-black">{risk.rrRatio || '0.00'}</span>
                         <span className={`px-1.5 py-0.5 rounded text-[7px] font-black uppercase ${risk.rrRatio >= 2 ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'}`}>
                            {risk.rrRatio >= 2 ? 'Optimal' : risk.rrRatio >= 1.5 ? 'Acceptable' : 'Sub-optimal'}
                         </span>
                      </div>
                   </div>
                   <div className="flex justify-between text-[11px] font-bold">
                      <span className="text-slate-500 uppercase tracking-widest">Recommended</span>
                      <span className="text-white">{verdict.suggestedAction}</span>
                   </div>
                   <div className="flex justify-between text-[11px] font-bold">
                      <span className="text-slate-500 uppercase tracking-widest">Risk Index</span>
                      <span className="text-slate-300">{risk.score}/100</span>
                   </div>
                </div>
             </div>

             <div className="relative z-10 space-y-4 mt-12 md:mt-0">
                <button
                   onClick={onConfirm}
                   className={`w-full py-5 rounded-2xl text-[11px] font-black uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-2 shadow-2xl ${style.btn} text-white hover:scale-[1.02] active:scale-95`}
                >
                   Authorize Execution <ArrowRight size={16} />
                </button>
                <button
                   onClick={onClose}
                   className="w-full py-5 text-[10px] font-black text-slate-500 uppercase tracking-widest hover:text-white transition-colors"
                >
                   Abort Order
                </button>
             </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
