import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { 
  User, ShieldCheck, Zap, Activity, 
  BarChart3, Brain, History, Target,
  TrendingUp, ArrowRight, ShieldAlert,
  Terminal, CheckCircle, Info
} from "lucide-react";
import { getPortfolioSummary } from "../../services/portfolio.api";
import { getTradeHistory } from "../../services/trade.api";
import { useAuth } from "../auth/AuthContext";
import { formatINR } from "../../utils/currency.utils";

/**
 * TRADER PROFILE — PERFORMANCE IDENTITY ACTIVE
 * Dynamic representation of skill, behavior, and growth.
 */
export default function ProfilePage() {
  const { user: authUser } = useAuth();
  
  const { data: summaryResponse, isLoading: summaryLoading } = useQuery({
    queryKey: ["portfolio"],
    queryFn: getPortfolioSummary
  });

  const { data: tradesResponse } = useQuery({
    queryKey: ["journal-trades"],
    queryFn: () => getTradeHistory(1, 10),
  });

  const summary = summaryResponse?.summary;
  const audit = summary?.skillAudit;
  const behavior = summary?.behaviorInsights;
  const recentReflections = tradesResponse?.trades?.filter(t => t.learningOutcome).slice(0, 3) || [];

  if (summaryLoading) return (
     <div className="flex items-center justify-center min-h-[60vh]">
        <Activity size={32} className="text-indigo-600 animate-pulse" />
     </div>
  );

  return (
    <div className="app-page px-2 pt-4 pb-20">
      {/* ── IDENTITY HEADER ── */}
      <header className="bg-white p-12 rounded-[3.5rem] border border-slate-100 shadow-sm mb-12 flex flex-col md:flex-row items-center gap-12">
         <div className="relative">
            <div className="w-32 h-32 bg-slate-900 rounded-[2.5rem] flex items-center justify-center border-4 border-indigo-500/20">
               <User size={48} className="text-white" />
            </div>
            <div className="absolute -bottom-2 -right-2 bg-indigo-600 text-white p-2 rounded-xl shadow-lg border-2 border-white">
               <ShieldCheck size={16} />
            </div>
         </div>
         
         <div className="flex-1 text-center md:text-left">
            <div className="flex flex-col md:flex-row md:items-center gap-4 mb-3">
               <h1 className="text-4xl font-black text-slate-900 tracking-tighter">{authUser?.name || 'Institutional Trader'}</h1>
               <div className="inline-flex items-center gap-2 px-3 py-1 bg-indigo-50 text-indigo-600 rounded-full text-[10px] font-black uppercase tracking-widest mx-auto md:mx-0">
                  {audit?.level || 'EVALUATING'} • {audit?.trend || 'STABLE'}
               </div>
            </div>
            <p className="text-slate-500 font-bold max-w-xl leading-relaxed">
               {audit?.suggestion || "Maintain protocol adherence to achieve Institutional grading status."}
            </p>
         </div>

         <div className="bg-slate-900 text-white p-8 rounded-[2.5rem] text-center min-w-[180px] shadow-xl shadow-slate-900/10">
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1 block">Global Skill Score</span>
            <span className="text-5xl font-black text-emerald-400">{audit?.score || 0}</span>
            <span className="block text-[8px] font-bold text-slate-600 mt-2 tracking-[0.2em] uppercase underline decoration-indigo-500 decoration-2">Verified Skillset</span>
         </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
         
         {/* ── LEFT COLUMN: BREAKDOWN & DNA ── */}
         <div className="lg:col-span-8 space-y-10">
            
            {/* SKILL BREAKDOWN MATRIX */}
            <div className="bg-white p-10 rounded-[3rem] border border-slate-100 shadow-sm">
               <div className="flex items-center gap-3 mb-10">
                  <BarChart3 size={18} className="text-indigo-600" />
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">Institutional Breakdown</span>
               </div>
               
               <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  {Object.entries(audit?.breakdown || {}).map(([key, value]) => (
                    <div key={key} className="space-y-3">
                       <div className="flex justify-between items-end">
                          <span className="text-[10px] font-black text-slate-900 uppercase tracking-widest">{key.replace(/([A-Z])/g, ' $1')}</span>
                          <span className="text-lg font-black text-slate-900">{value}%</span>
                       </div>
                       <div className="h-1.5 bg-slate-50 rounded-full overflow-hidden">
                          <motion.div 
                             initial={{ width: 0 }} animate={{ width: `${value}%` }}
                             className="h-full bg-indigo-600"
                          />
                       </div>
                    </div>
                  ))}
               </div>
            </div>

            {/* BEHAVIORAL DNA */}
            <div className="bg-white p-10 rounded-[3rem] border border-slate-100 shadow-sm">
               <div className="flex items-center gap-3 mb-10">
                  <Brain size={18} className="text-amber-500" />
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">Behavioral DNA</span>
               </div>

               <div className="space-y-6">
                  {behavior?.patterns?.map((p, i) => (
                    <div key={i} className="flex flex-col md:flex-row md:items-center justify-between p-6 bg-slate-50 rounded-[2rem] border border-slate-100 gap-6">
                       <div className="flex items-start gap-4">
                          <div className={`p-3 rounded-2xl ${p.severity === 'CRITICAL' ? 'bg-rose-100 text-rose-600' : 'bg-indigo-100 text-indigo-600'}`}>
                             <Activity size={18} />
                          </div>
                          <div>
                             <h4 className="text-[11px] font-black text-slate-900 uppercase tracking-widest">{p.name}</h4>
                             <p className="text-[10px] font-bold text-slate-500 mt-1">{p.description}</p>
                          </div>
                       </div>
                       <div className="text-right shrink-0">
                          <span className="block text-[8px] font-black text-slate-400 uppercase tracking-widest">Confidence</span>
                          <span className="text-xl font-black text-slate-900">{p.confidence}%</span>
                       </div>
                    </div>
                  ))}
                  {(!behavior?.patterns || behavior.patterns.length === 0) && (
                    <div className="py-12 text-center border border-dashed border-slate-200 rounded-[2.5rem]">
                       <CheckCircle size={32} className="mx-auto text-emerald-500 mb-4" />
                       <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">No destructive patterns detected in DNA footprint.</p>
                    </div>
                  )}
               </div>
            </div>

            {/* RECENT LEARNINGS */}
            <div className="space-y-6 px-2">
               <div className="flex items-center gap-3 mb-4">
                  <History size={16} className="text-slate-400" />
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Executive Reflections</span>
               </div>
               
               <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {recentReflections.map((t, i) => (
                    <div key={i} className="bg-slate-900 p-8 rounded-[2.5rem] border border-white/5 relative overflow-hidden group">
                       <div className="absolute top-0 right-0 p-6 opacity-0 group-hover:opacity-10 transition-opacity">
                          <Target size={64} className="text-white" />
                       </div>
                       <div className="relative z-10 flex flex-col h-full justify-between gap-6">
                          <div>
                             <span className="text-[8px] font-black text-indigo-400 uppercase tracking-[0.2em] mb-2 block">{t.symbol} • {t.learningOutcome?.type}</span>
                             <p className="text-sm font-bold text-slate-200 leading-relaxed italic">"{t.learningOutcome?.insight}"</p>
                          </div>
                          <div className="flex items-center justify-between pt-4 border-t border-white/5">
                             <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Hindsight Protocol</span>
                             <div className={`w-2 h-2 rounded-full ${t.pnl >= 0 ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                          </div>
                       </div>
                    </div>
                  ))}
               </div>
            </div>

         </div>

         {/* ── RIGHT COLUMN: ALIGNMENT & STATE ── */}
         <div className="lg:col-span-4 space-y-10">
            
            {/* SYSTEM ALIGNMENT */}
            <div className="bg-slate-900 p-10 rounded-[3rem] text-white shadow-xl">
               <div className="flex items-center justify-between mb-10">
                  <div className="flex items-center gap-3">
                     <ShieldCheck size={18} className="text-emerald-400" />
                     <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em]">Protocol Alignment</span>
                  </div>
                  <Info size={14} className="text-slate-600" />
               </div>
               
               <div className="flex flex-col items-center text-center mb-10">
                  <div className="w-40 h-40 rounded-full border-8 border-white/5 flex items-center justify-center relative shadow-[0_0_50px_rgba(16,185,129,0.1)]">
                     <div className="text-center">
                        <span className="text-4xl font-black text-white">{behavior?.riskProfile?.disciplineScore || 0}%</span>
                        <span className="block text-[8px] font-black text-slate-500 uppercase tracking-widest mt-1">Consistency</span>
                     </div>
                  </div>
               </div>

               <div className="space-y-4 pt-8 border-t border-white/5">
                  <div className="flex justify-between text-[10px] font-black uppercase tracking-widest">
                     <span className="text-slate-500">Risk Variance</span>
                     <span className="text-indigo-400">Low</span>
                  </div>
                  <div className="flex justify-between text-[10px] font-black uppercase tracking-widest">
                     <span className="text-slate-500">Decision Bias</span>
                     <span className="text-emerald-400">Neutral</span>
                  </div>
               </div>
            </div>

            {/* PERFORMANCE STRENGTHS */}
            <div className="bg-white p-10 rounded-[3rem] border border-slate-100 shadow-sm">
               <div className="flex items-center gap-3 mb-8">
                  <Zap size={18} className="text-amber-500" />
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">Key Strengths</span>
               </div>
               
               <div className="space-y-3">
                  {audit?.strengths?.map((s, i) => (
                    <div key={i} className="flex items-center gap-3 p-4 bg-emerald-50 rounded-2xl text-emerald-700 font-bold text-[11px]">
                       <CheckCircle size={14} />
                       {s}
                    </div>
                  ))}
                  {(!audit?.strengths || audit.strengths.length === 0) && (
                     <p className="text-[10px] font-bold text-slate-400 italic">Evaluating performance vectors...</p>
                  )}
               </div>
            </div>

            {/* PERFORMANCE WEAKNESSES */}
            <div className="bg-white p-10 rounded-[3rem] border border-slate-100 shadow-sm">
               <div className="flex items-center gap-3 mb-8">
                  <ShieldAlert size={18} className="text-rose-500" />
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">Warning Signatures</span>
               </div>
               
               <div className="space-y-3">
                  {audit?.weaknesses?.map((w, i) => (
                    <div key={i} className="flex items-center gap-3 p-4 bg-rose-50 rounded-2xl text-rose-700 font-bold text-[11px]">
                       <ShieldAlert size={14} />
                       {w}
                    </div>
                  ))}
                  {(!audit?.weaknesses || audit.weaknesses.length === 0) && (
                     <p className="text-[10px] font-bold text-slate-400 italic">No critical signatures detected.</p>
                  )}
               </div>
            </div>

         </div>

      </div>
    </div>
  );
}
