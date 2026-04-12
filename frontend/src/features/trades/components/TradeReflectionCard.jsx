import React from 'react';
import { BookOpen, TrendingUp, TrendingDown, Clock, Lightbulb, Activity, Target, ShieldAlert } from 'lucide-react';
import { motion } from 'framer-motion';

export default function TradeReflectionCard({ reflection }) {
  if (!reflection) return null;

  const { outcome, alignment, pnl, duration, keyObservations, behavioralFlags, learningTags, insightSummary } = reflection;

  const outcomeColors = {
    WIN: "text-emerald-500 bg-emerald-500/10 border-emerald-500/20",
    LOSS: "text-rose-500 bg-rose-500/10 border-rose-500/20",
    NEUTRAL: "text-slate-400 bg-slate-400/10 border-slate-400/20"
  };

  const alignStyles = {
    WITH_TREND: "text-emerald-500 bg-emerald-500/10",
    AGAINST_TREND: "text-amber-500 bg-amber-500/10"
  };

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="p-10 bg-white rounded-[3rem] border border-slate-100 shadow-xl space-y-8"
    >
       <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
             <div className="p-3 bg-indigo-600 text-white rounded-2xl shadow-lg shadow-indigo-600/20">
                <BookOpen size={20} />
             </div>
             <div>
                <h3 className="text-xl font-black text-slate-900 tracking-tight">Trade Reflection</h3>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Post-Execution Analytics</p>
             </div>
          </div>
          <div className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border ${outcomeColors[outcome]}`}>
             Outcome: {outcome}
          </div>
       </div>

       {/* Matrix Stats */}
       <div className="grid grid-cols-2 gap-4">
          <div className="p-6 bg-slate-50 rounded-3xl border border-slate-100">
             <div className="flex items-center gap-2 mb-2 text-slate-400">
                <Target size={14} />
                <span className="text-[9px] font-black uppercase tracking-widest">Trend Alignment</span>
             </div>
             <p className={`text-lg font-black ${alignStyles[alignment].split(' ')[0]}`}>
                {alignment.replace('_', ' ')}
             </p>
          </div>
          <div className="p-6 bg-slate-50 rounded-3xl border border-slate-100">
             <div className="flex items-center gap-2 mb-2 text-slate-400">
                <Clock size={14} />
                <span className="text-[9px] font-black uppercase tracking-widest">Duration</span>
             </div>
             <p className="text-lg font-black text-slate-900">{duration}m <span className="text-[10px] text-slate-400">Execution time</span></p>
          </div>
       </div>

       {/* AI Insight */}
       <div className="p-6 bg-indigo-50 border border-indigo-100 rounded-3xl relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-10">
             <Lightbulb size={60} className="text-indigo-600" />
          </div>
          <p className="text-sm font-bold text-indigo-900 leading-relaxed italic relative z-10">
             "{insightSummary}"
          </p>
       </div>

       {/* Factual Observations */}
       <div className="space-y-4">
          <div className="flex items-center gap-2 text-slate-400 ml-1">
             <Activity size={14} />
             <span className="text-[9px] font-black uppercase tracking-widest">Core Observations</span>
          </div>
          <div className="space-y-2">
             {keyObservations.map((obs, i) => (
                <div key={i} className="flex items-start gap-3 p-4 bg-slate-50 border border-slate-100 rounded-2xl">
                   <div className="mt-1.5 w-1.5 h-1.5 rounded-full bg-slate-300" />
                   <p className="text-[11px] font-bold text-slate-600 leading-snug">{obs}</p>
                </div>
             ))}
          </div>
       </div>

       {/* Learning Tags */}
       <div className="pt-6 border-t border-slate-100">
          <div className="flex items-center gap-2 mb-4 text-slate-400 ml-1">
             <ShieldAlert size={14} />
             <span className="text-[9px] font-black uppercase tracking-widest">Detected Learning Signals</span>
          </div>
          <div className="flex flex-wrap gap-2">
             {learningTags.map(tag => (
                <span key={tag} className="px-4 py-2 bg-slate-900 text-white text-[9px] font-black rounded-lg uppercase tracking-widest border border-slate-800 shadow-sm">
                   {tag}
                </span>
             ))}
             {behavioralFlags.map(flag => (
                <span key={flag} className="px-4 py-2 bg-rose-50 text-rose-600 text-[9px] font-black rounded-lg uppercase tracking-widest border border-rose-100">
                   {flag.replace(/_/g, " ")}
                </span>
             ))}
          </div>
       </div>
    </motion.div>
  );
}
