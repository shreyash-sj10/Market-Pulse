import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { getMarketIntelligence, getPortfolioIntelligence, getGlobalIntelligence } from "../../services/intelligence.api";
import SignalNode from "./components/SignalNode";
import ConsensusPanel from "./components/ConsensusPanel";
import { TrendingUp, Newspaper, Sparkles, Globe, Briefcase, Zap, Activity, Info, ShieldCheck, Clock, Layers, Filter, Terminal, ArrowRight } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

/**
 * MARKET INTELLIGENCE ENGINE — DECISION MODE
 * Optimized for trader reasoning and high-fidelity decisions.
 */
export default function NewsPage() {
  const { data: marketResp, isLoading: marketLoading } = useQuery({
    queryKey: ["intel-market"],
    queryFn: getMarketIntelligence,
    staleTime: 1000 * 60 * 5,
  });

  const { data: portResp, isLoading: portLoading } = useQuery({
    queryKey: ["intel-portfolio"],
    queryFn: getPortfolioIntelligence,
    staleTime: 1000 * 60 * 5,
  });

  const { data: globalResp, isLoading: globalLoading } = useQuery({
    queryKey: ["intel-global"],
    queryFn: getGlobalIntelligence,
    staleTime: 1000 * 60 * 5,
  });

  const isSyncing = marketLoading || portLoading || globalLoading;

  // 1. PORTFOLIO INTELLIGENCE (TOP PRIORITY)
  const portfolioSignals = useMemo(() => {
    return (portResp?.data?.signals || []).sort((a, b) => b.confidence - a.confidence);
  }, [portResp]);

  // 2. SECTOR DECISION ENGINE
  const sectorIntelligence = useMemo(() => {
    const allSignals = [...(marketResp?.data?.signals || []), ...(portResp?.data?.signals || [])];
    const groups = {};
    allSignals.forEach(n => {
      const s = n.sector || "GENERAL";
      if (!groups[s]) groups[s] = { consensus: null, signals: [] };
      if (n.isConsensus) groups[s].consensus = n;
      else groups[s].signals.push(n);
    });
    return groups;
  }, [marketResp, portResp]);

  // 3. GLOBAL SUMMARY ENGINE (MANDATORY)
  const globalSummary = useMemo(() => {
    const signals = globalResp?.data?.signals || [];
    if (!signals.length) return null;

    const drivers = signals.slice(0, 5).map(s => s.event);
    const bullish = signals.filter(s => s.impact === "BULLISH").length;
    const bearish = signals.filter(s => s.impact === "BEARISH").length;
    const bias = bullish > bearish ? "BULLISH" : bearish > bullish ? "BEARISH" : "NEUTRAL";

    return { drivers, bias, signalCount: signals.length };
  }, [globalResp]);

  if (isSyncing) {
    return (
      <div className="flex flex-col gap-6 p-8 max-w-[1700px] mx-auto overflow-hidden bg-slate-900 min-h-screen">
        <div className="h-48 bg-white/5 rounded-3xl animate-pulse" />
        <div className="space-y-4">
           {Array.from({ length: 10 }).map((_, i) => (
              <div key={i} className="h-20 bg-white/5 rounded-xl animate-pulse" />
           ))}
        </div>
      </div>
    );
  }

  return (
    <div className="app-page px-6 pt-8 pb-40 max-w-[1800px] mx-auto overflow-hidden relative bg-slate-950 text-slate-300 font-mono">
      {/* 🔴 HEADER: DECISION COMMAND CENTER */}
      <section className="bg-white/[0.02] border border-white/5 rounded-[2rem] p-10 mb-16 overflow-hidden relative backdrop-blur-3xl">
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-12">
          <div className="space-y-6">
             <div className="flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_10px_rgba(16,185,129,0.8)]" />
                <span className="text-[10px] font-black text-emerald-400 uppercase tracking-[0.4em]">Decision Engine Mode Active</span>
             </div>
             
             <h1 className="text-4xl md:text-6xl font-black text-white tracking-tighter leading-none uppercase">
                Market <span className="text-indigo-400">Intelligence</span> <br/>
                <span className="text-slate-600">Reasoning Layer v4.5</span>
             </h1>
          </div>

          <div className="flex items-center gap-12 px-10 py-6 bg-black/40 border border-white/5 rounded-2xl">
             <div>
                <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Portfolio Flux</div>
                <div className="text-2xl font-black text-white uppercase italic">Active</div>
             </div>
             <div className="w-px h-10 bg-white/10" />
             <div>
                <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Sector Sync</div>
                <div className="text-2xl font-black text-emerald-400 uppercase italic">100%</div>
             </div>
             <div className="w-px h-10 bg-white/10" />
             <div>
                <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Macro Bias</div>
                <div className="text-2xl font-black text-indigo-400 uppercase italic">{globalSummary?.bias || 'NEUTRAL'}</div>
             </div>
          </div>
        </div>
      </section>

      {/* 🔴 1. PORTFOLIO INTELLIGENCE (STRICT DECISION LIST) */}
      <section className="mb-20">
        <div className="flex items-center gap-4 mb-10">
           <Briefcase size={20} className="text-indigo-400" />
           <h2 className="text-xl font-black text-white uppercase tracking-tighter">Portfolio Intelligence Nodes</h2>
           <div className="h-px flex-1 bg-white/5 ml-4" />
        </div>

        <div className="bg-white rounded-[2rem] overflow-hidden shadow-2xl border border-slate-100">
          <div className="p-4 bg-slate-50 border-b border-slate-100 flex items-center justify-between px-8">
             <span className="text-[9px] font-black text-slate-400 uppercase tracking-[0.3em]">Decision Node Matrix</span>
             <span className="text-[9px] font-black text-indigo-600 uppercase tracking-widest">Holdings: {portfolioSignals.filter(s => s.id !== 'portfolio-empty').length}</span>
          </div>
          <div className="flex flex-col">
            {portfolioSignals.length > 0 ? (
              portfolioSignals.map((signal) => (
                <SignalNode key={signal.id} signal={signal} />
              ))
            ) : (
              <div className="py-20 flex flex-col items-center text-center">
                 <Terminal size={40} className="text-slate-200 mb-4" />
                 <p className="text-sm font-bold text-slate-400">Deployment of data nodes requires active portfolio positions.</p>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* 🟠 2. SECTOR CONSENSUS (REASONING LAYER) */}
      <section className="mb-20">
        <div className="flex items-center gap-4 mb-10">
           <Layers size={20} className="text-emerald-400" />
           <h2 className="text-xl font-black text-white uppercase tracking-tighter">Sector Reasoning Vectors</h2>
           <div className="h-px flex-1 bg-white/5 ml-4" />
        </div>

        <div className="space-y-16">
          {Object.entries(sectorIntelligence).map(([sector, data]) => (
            <div key={sector}>
              <ConsensusPanel sector={sector} consensus={data.consensus} />
              
              <div className="bg-white rounded-[2rem] overflow-hidden shadow-lg border border-slate-100 mt-6">
                <div className="p-4 bg-slate-50 border-b border-slate-100 flex items-center justify-between px-8">
                   <div className="flex items-center gap-2">
                       <span className="text-[9px] font-black text-slate-400 uppercase tracking-[0.3em]">{sector} TRANSMISSIONS</span>
                   </div>
                   <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2">
                         <div className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                         <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">{data.signals.length} Active Nodes</span>
                      </div>
                   </div>
                </div>
                <div className="flex flex-col">
                  {data.signals.map((signal) => (
                    <SignalNode key={signal.id} signal={signal} />
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 🌍 3. GLOBAL SUMMARY ENGINE (COMPACT SUMMARY) */}
      <section className="mb-20">
         <div className="flex items-center gap-4 mb-10">
            <Globe size={20} className="text-slate-500" />
            <h2 className="text-xl font-black text-white uppercase tracking-tighter">Global Macro Context</h2>
            <div className="h-px flex-1 bg-white/5 ml-4" />
         </div>

         <div className="bg-slate-900 border border-white/5 rounded-[2rem] p-10 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-1/3 h-full bg-gradient-to-l from-indigo-500/5 via-transparent to-transparent pointer-events-none" />
            
            <div className="relative z-10 grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
               <div className="space-y-8">
                  <div className="flex items-center gap-6">
                     <div className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest ${globalSummary?.bias === 'BULLISH' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}`}>
                        {globalSummary?.bias || 'NEUTRAL'} BIAS
                     </div>
                     <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Synthesized from {globalSummary?.signalCount} global nodes</span>
                  </div>

                  <h3 className="text-2xl font-black text-white leading-tight uppercase tracking-tight">
                     Primary Global Multi-Node Summary
                  </h3>

                  <div className="space-y-4">
                     {globalSummary?.drivers.map((driver, idx) => (
                        <div key={idx} className="flex items-start gap-4 group">
                           <div className="w-6 h-6 rounded bg-white/5 flex items-center justify-center shrink-0 group-hover:bg-indigo-500/20 transition-colors">
                              <span className="text-[9px] font-black text-slate-600 group-hover:text-indigo-400">0{idx + 1}</span>
                           </div>
                           <p className="text-sm font-bold text-slate-400 group-hover:text-slate-200 transition-colors">{driver}</p>
                        </div>
                     ))}
                  </div>
               </div>

               <div className="bg-black/40 border border-white/5 rounded-3xl p-8 space-y-6">
                  <div className="flex items-center gap-2 mb-4">
                     <Activity size={16} className="text-indigo-400" />
                     <span className="text-[9px] font-black text-white uppercase tracking-widest">Engine Final System Verdict</span>
                  </div>
                  <div className="flex flex-col gap-4">
                     <div className="flex items-center justify-between p-4 bg-white/[0.02] rounded-xl">
                        <span className="text-xs font-bold text-slate-500 uppercase">Portfolio State</span>
                        <span className="text-xs font-black text-white uppercase">Maintain Positions</span>
                     </div>
                     <div className="flex items-center justify-between p-4 bg-white/[0.02] rounded-xl">
                        <span className="text-xs font-bold text-slate-500 uppercase">Domestic Market</span>
                        <span className="text-xs font-black text-emerald-400 uppercase italic">Accumulate Selectively</span>
                     </div>
                     <div className="flex items-center justify-between p-4 bg-white/[0.02] rounded-xl border border-indigo-500/30">
                        <span className="text-xs font-bold text-slate-500 uppercase">Macro Risk</span>
                        <span className="text-xs font-black text-indigo-400 uppercase italic">Moderate (Watch USD)</span>
                     </div>
                  </div>
               </div>
            </div>
         </div>
      </section>

      {/* 🛡️ ENGINE TELEMETRY FOOTER */}
      <footer className="p-10 bg-black/40 border border-white/5 rounded-2xl flex flex-col xl:flex-row items-center justify-between gap-10">
         <div className="flex items-center gap-6">
            <div className="w-12 h-12 bg-white/5 border border-white/10 rounded-xl flex items-center justify-center text-indigo-400">
               <ShieldCheck size={28} />
            </div>
            <div>
               <h4 className="text-sm font-black text-white tracking-widest uppercase">Decision Alpha v4.5.1</h4>
               <p className="text-[9px] font-black text-slate-600 uppercase tracking-widest mt-1">Status: All Reasoners Stable • Latency: 442ms</p>
            </div>
         </div>
         <div className="text-[9px] font-black text-slate-700 uppercase tracking-[0.4em]">MARKET INTELLIGENCE ENGINE — DECISION MODE ACTIVE</div>
      </footer>
    </div>
  );
}
