import React from 'react';
import { ShieldAlert, TrendingUp, TrendingDown, Target, Info, Sparkles, AlertCircle } from 'lucide-react';
import { motion } from 'framer-motion';

export default function TradeEvaluationCard({ evaluation, loading }) {
  if (loading) {
    return (
      <div className="p-8 bg-slate-900 rounded-[2.5rem] border border-white/10 animate-pulse">
        <div className="flex items-center gap-3 mb-6">
           <div className="w-10 h-10 bg-white/5 rounded-2xl" />
           <div className="h-4 w-32 bg-white/5 rounded" />
        </div>
        <div className="space-y-3">
           <div className="h-4 w-full bg-white/5 rounded" />
           <div className="h-4 w-2/3 bg-white/5 rounded" />
        </div>
      </div>
    );
  }

  if (!evaluation) return null;

  const { alignment, riskScore, summary, keyPoints, flags } = evaluation;

  const alignmentStyles = {
    WITH_TREND: { label: "With Trend", color: "text-emerald-400", bg: "bg-emerald-500/10", icon: <TrendingUp size={16} /> },
    AGAINST_TREND: { label: "Against Trend", color: "text-rose-400", bg: "bg-rose-500/10", icon: <TrendingDown size={16} /> },
    NEUTRAL: { label: "Neutral Alignment", color: "text-slate-400", bg: "bg-slate-500/10", icon: <Target size={16} /> }
  };

  const align = alignmentStyles[alignment] || alignmentStyles.NEUTRAL;

  const getRiskColor = (score) => {
    if (score >= 70) return "text-rose-400";
    if (score >= 40) return "text-amber-400";
    return "text-emerald-400";
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="p-8 bg-slate-930 border border-white/10 rounded-[2.5rem] shadow-2xl relative overflow-hidden"
    >
       {/* High Impact Glow */}
       {riskScore >= 70 && <div className="absolute top-0 right-0 w-32 h-32 bg-rose-500/10 blur-[60px] rounded-full -mr-16 -mt-16" />}

       <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
             <div className="p-3 bg-white/5 border border-white/10 rounded-2xl text-indigo-400">
                <Sparkles size={20} />
             </div>
             <div>
                <h3 className="text-white font-black text-sm uppercase tracking-widest">Trade Evaluation</h3>
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Final Judgment Engine</p>
             </div>
          </div>
          <div className={`px-4 py-2 ${align.bg} ${align.color} rounded-xl flex items-center gap-2 border border-current/10`}>
             {align.icon}
             <span className="text-[10px] font-black uppercase tracking-widest">{align.label}</span>
          </div>
       </div>

       {/* Risk Score Dial */}
       <div className="mb-8">
          <div className="flex items-center justify-between mb-3 px-1">
             <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Projected Exposure Risk</span>
             <span className={`text-xl font-black ${getRiskColor(riskScore)}`}>{riskScore}%</span>
          </div>
          <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden flex">
             <motion.div 
                initial={{ width: 0 }}
                animate={{ width: `${riskScore}%` }}
                transition={{ duration: 1, ease: "easeOut" }}
                className={`h-full ${riskScore >= 70 ? 'bg-rose-500' : 'bg-indigo-500'}`}
             />
          </div>
       </div>

       {/* AI Summary */}
       <div className="p-6 bg-white/5 border border-white/5 rounded-[1.5rem] mb-8">
          <p className="text-[13px] font-bold text-white leading-relaxed italic pr-4">
             "{summary}"
          </p>
       </div>

       {/* Key Observations */}
       <div className="space-y-4">
          <div className="flex items-center gap-2 text-slate-500 ml-1">
             <AlertCircle size={12} />
             <span className="text-[9px] font-black uppercase tracking-[0.2em]">Key Observations</span>
          </div>
          <div className="space-y-2">
             {keyPoints.map((point, i) => (
                <div key={i} className="flex items-start gap-3 p-4 bg-white/2 rounded-2xl border border-white/5">
                   <div className="mt-1.5 w-1.5 h-1.5 rounded-full bg-indigo-500 shadow-lg shadow-indigo-500/50" />
                   <p className="text-[11px] font-bold text-slate-300 tracking-tight leading-snug">{point}</p>
                </div>
             ))}
          </div>
       </div>

       {/* Context Flags */}
       {flags.length > 0 && (
          <div className="mt-8 pt-8 border-t border-white/5 flex flex-wrap gap-2">
             {flags.map(f => (
                <span key={f} className="px-3 py-1 bg-white/5 text-[9px] font-black text-rose-400 rounded-full border border-rose-500/20 uppercase tracking-tighter">
                   {f.replace(/_/g, " ")}
                </span>
             ))}
          </div>
       )}
    </motion.div>
  );
}
