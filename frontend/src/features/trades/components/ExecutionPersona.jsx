import React from 'react';
import { Brain, Zap, Shield, TrendingUp, AlertCircle, Activity } from 'lucide-react';
import { motion } from 'framer-motion';

/**
 * PRODUCTION-GRADE TRADER PERSONA DISPLAY
 * Encapsulates the adaptive intelligence profile of the user.
 */
export default function ExecutionPersona({ persona, loading }) {
  if (loading) return <div className="h-64 bg-slate-900 animate-pulse rounded-[2.5rem]" />;
  if (!persona) return null;

  const { sensitivityLevel, dominantPatterns = [], riskBias, rulesApplied = [] } = persona;

  return (
    <motion.div 
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      className="p-10 bg-slate-900 text-white rounded-[2.5rem] border border-white/10 shadow-2xl relative overflow-hidden"
    >
       {/* Background Glow */}
       <div className="absolute top-0 right-0 w-40 h-40 bg-indigo-500/10 blur-[80px] -mr-20 -mt-20" />

       <div className="flex items-center gap-4 mb-10">
          <div className="p-3 bg-white/5 border border-white/10 rounded-2xl text-indigo-400">
             <Brain size={24} />
          </div>
          <div>
             <h3 className="text-xl font-black tracking-tight">Execution Persona</h3>
             <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest leading-none mt-1">Adaptive Intelligence System</p>
          </div>
       </div>

       <div className="grid grid-cols-2 gap-6 mb-10">
          <div className="p-6 bg-white/5 border border-white/5 rounded-3xl">
             <div className="flex items-center gap-2 mb-2 text-slate-400">
                <Shield size={14} />
                <span className="text-[9px] font-black uppercase tracking-widest">Risk Bias</span>
             </div>
             <p className={`text-lg font-black ${riskBias === 'AGGRESSIVE' ? 'text-rose-400' : 'text-emerald-400'}`}>
                {riskBias || 'NEUTRAL'}
             </p>
          </div>
          <div className="p-6 bg-white/5 border border-white/5 rounded-3xl">
             <div className="flex items-center gap-2 mb-2 text-slate-400">
                <Activity size={14} />
                <span className="text-[9px] font-black uppercase tracking-widest">Sensitivity</span>
             </div>
             <p className={`text-lg font-black ${sensitivityLevel === 'HIGH' ? 'text-amber-400' : 'text-slate-400'}`}>
                {sensitivityLevel || 'STABLE'}
             </p>
          </div>
       </div>

       <div className="space-y-6">
          <div className="flex items-center gap-2 text-slate-500 ml-1">
             <TrendingUp size={14} />
             <span className="text-[9px] font-black uppercase tracking-widest">Dominant Behavioral Patterns</span>
          </div>
          <div className="space-y-3">
             {dominantPatterns.slice(0, 3).map((p, i) => (
                <div key={i} className="flex items-center justify-between p-4 bg-white/2 border border-white/5 rounded-2xl group hover:bg-white/5 transition-colors">
                   <div className="flex items-center gap-3">
                      <div className={`w-1.5 h-1.5 rounded-full ${p.strength === 'STRONG_PATTERN' ? 'bg-rose-500 animate-pulse' : 'bg-amber-500'}`} />
                      <span className="text-[11px] font-bold text-slate-300">{p.tag.replace(/_/g, ' ')}</span>
                   </div>
                   <span className="text-[9px] font-black text-slate-600 uppercase tracking-tighter">{p.count} Occurrences</span>
                </div>
             ))}
             {dominantPatterns.length === 0 && (
                <p className="text-xs font-bold text-slate-600 italic px-2">No recurring cognitive anchors detected yet.</p>
             )}
          </div>
       </div>

       {rulesApplied.length > 0 && (
          <div className="mt-10 pt-8 border-t border-white/5">
             <div className="flex items-center gap-2 mb-4 text-slate-500 ml-1">
                <Zap size={14} className="text-amber-400" />
                <span className="text-[9px] font-black uppercase tracking-widest">System Adaptations Applied</span>
             </div>
             <div className="flex flex-wrap gap-2">
                {rulesApplied.map(rule => (
                   <span key={rule} className="px-3 py-1 bg-indigo-500/10 text-[9px] font-black text-indigo-400 rounded-lg border border-indigo-500/20 uppercase tracking-tighter">
                      {rule.replace(/_/g, " ")}
                   </span>
                ))}
             </div>
          </div>
       )}
    </motion.div>
  );
}
