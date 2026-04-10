import { motion } from "framer-motion";
import { 
  Trophy, AlertOctagon, Dice5, 
  ArrowUpRight, Brain, Lightbulb,
  CheckCircle2, Sparkles, Target, Compass, 
  Activity, Shield
} from "lucide-react";
import { formatINR } from "../../../utils/currency.utils";

const TradeReviewCard = ({ trade, review }) => {
  if (!trade || !review) return null;

  const verdictStyles = {
    GOOD: {
      color: "text-emerald-500",
      bg: "bg-emerald-500/10",
      border: "border-emerald-500/20",
      icon: <Trophy size={20} />,
      label: "Institutional Grade Execution"
    },
    POOR: {
      color: "text-rose-500",
      bg: "bg-rose-500/10",
      border: "border-rose-500/20",
      icon: <AlertOctagon size={20} />,
      label: "Psychological Breakdown"
    },
    LUCK: {
      color: "text-amber-500",
      bg: "bg-amber-500/10",
      border: "border-amber-500/20",
      icon: <Dice5 size={20} />,
      label: "Result Outliers (Lucky)"
    }
  };

  const style = verdictStyles[review.verdict] || verdictStyles.GOOD;
  const missed = trade.missedOpportunity;
  const score = trade.analysis?.decisionScore || { totalScore: 0, breakdown: {} };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      className={`rounded-3xl border ${style.border} ${style.bg} p-8 relative overflow-hidden group`}
    >
      {/* Background Polish */}
      <div className={`absolute top-0 right-0 p-6 opacity-5 group-hover:opacity-10 transition-opacity ${style.color}`}>
         {style.icon}
      </div>

      <div className="relative z-10">
        <div className="flex items-center justify-between mb-8">
           <div className="flex items-center gap-4">
              <div className={`p-3 rounded-2xl ${style.bg} ${style.color} border ${style.border}`}>
                 {style.icon}
              </div>
              <div>
                 <span className={`text-[10px] font-black uppercase tracking-[0.2em] ${style.color}`}>
                   Performance Verdict: {review.verdict}
                 </span>
                 <h3 className="text-xl font-black text-slate-900 tracking-tight">{style.label}</h3>
              </div>
           </div>
           
           <div className="relative flex items-center justify-center">
              <svg className="w-16 h-16 transform -rotate-90">
                <circle cx="32" cy="32" r="28" stroke="currentColor" strokeWidth="4" fill="transparent" className="text-slate-200" />
                <circle 
                  cx="32" cy="32" r="28" stroke="currentColor" strokeWidth="4" fill="transparent" 
                  className={style.color}
                  strokeDasharray={176}
                  strokeDashoffset={176 - (176 * score.totalScore) / 100}
                  strokeLinecap="round"
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-lg font-black text-slate-900">{score.totalScore}</span>
              </div>
           </div>
        </div>

        {/* Breakdown Grid */}
        <div className="grid grid-cols-4 gap-3 mb-8">
            {[
               { label: 'Intent', value: score.breakdown?.intent ?? 0, max: 25, icon: <Target size={12} /> },
               { label: 'Context', value: score.breakdown?.context ?? 0, max: 25, icon: <Compass size={12} /> },
               { label: 'Discipline', value: score.breakdown?.discipline ?? 0, max: 25, icon: <Shield size={12} /> },
               { label: 'Efficiency', value: score.breakdown?.efficiency ?? 0, max: 25, icon: <Activity size={12} /> }
            ].map((item, i) => (
               <div key={i} className="bg-white/40 p-3 rounded-xl border border-white/40">
                  <div className="flex items-center gap-1.5 mb-2 text-slate-400">
                     {item.icon}
                     <span className="text-[7px] font-black uppercase tracking-widest">{item.label}</span>
                  </div>
                  <div className="flex items-end justify-between">
                     <span className="text-xs font-black text-slate-900">{item.value}</span>
                     <span className="text-[7px] font-bold text-slate-300">/ {item.max}</span>
                  </div>
               </div>
            ))}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-1 gap-6 mb-8">
           <div className="p-6 bg-white/60 rounded-2xl border border-white/40 shadow-sm">
             <div className="flex items-center gap-2 mb-3">
               <Brain size={14} className="text-indigo-600" />
               <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Post-Mortem Summary</span>
             </div>
             <p className="text-sm font-bold text-slate-700 leading-relaxed italic">
               "{review.aiSummary || "Analysis finalized. System detected disciplined execution against stated intent."}"
             </p>
           </div>
        </div>

        <div className="space-y-4">
           {/* Missed Alpha Section */}
           {missed && missed.maxPotentialProfit > 0 && (
             <div className="flex items-center justify-between p-4 bg-emerald-500/5 rounded-xl border border-emerald-500/10">
                <div className="flex items-center gap-3">
                   <div className="p-1.5 bg-emerald-100 rounded-lg text-emerald-600">
                      <Sparkles size={12} />
                   </div>
                   <span className="text-[11px] font-bold text-slate-600">Alpha Left on Table</span>
                </div>
                <div className="text-right">
                   <span className="text-[11px] font-bold text-emerald-600">+{missed.maxProfitPct}% {formatINR(missed.maxPotentialProfit)}</span>
                </div>
             </div>
           )}

           {/* The improvement Rule */}
           <div className="p-6 bg-slate-900 rounded-2xl border border-slate-800 shadow-xl relative overflow-hidden">
              <div className="flex items-center gap-2 mb-4">
                 <Lightbulb size={16} className="text-amber-400" />
                 <span className="text-[10px] font-black uppercase tracking-widest text-indigo-400">Growth Protocol: Improvement Rule</span>
              </div>
              <p className="text-xs font-bold text-white leading-normal pl-1">
                 {review.improvementRule}
              </p>
              <div className="mt-4 flex items-center gap-2 text-[9px] font-bold text-slate-500 uppercase tracking-widest">
                 <CheckCircle2 size={12} className="text-indigo-500" /> Commit to Journal
              </div>
           </div>
        </div>
      </div>
    </motion.div>
  );
};

export default TradeReviewCard;
