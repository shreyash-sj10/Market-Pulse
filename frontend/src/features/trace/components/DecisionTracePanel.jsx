import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Zap, Target, Activity, ShieldAlert, 
  ChevronDown, ChevronUp, Terminal, 
  CheckCircle, AlertTriangle, XCircle, 
  ShieldCheck, ArrowRight, Info
} from "lucide-react";

/**
 * DECISION TRACE PANEL — FULL TRANSPARENCY ENABLED
 * Displays the 5-layer reasoning behind a trade decision.
 */
export default function DecisionTracePanel({ trace }) {
  if (!trace || !trace.layers) return (
     <div className="p-10 text-center bg-slate-50 rounded-[2rem] border border-dashed border-slate-200">
        <Terminal size={32} className="mx-auto text-slate-300 mb-4" />
        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Incompatible Trace Format</p>
     </div>
  );

  const [expandedLayer, setExpandedLayer] = useState(null);

  const layers = [
    { id: 'market', name: 'Market Intelligence', icon: <Zap size={18} />, color: 'indigo', data: trace.layers.market },
    { id: 'setup', name: 'Trade Setup', icon: <Target size={18} />, color: 'blue', data: trace.layers.setup },
    { id: 'behavior', name: 'Behavioral Analysis', icon: <Activity size={18} />, color: 'amber', data: trace.layers.behavior },
    { id: 'risk', name: 'Risk Evaluation', icon: <ShieldAlert size={18} />, color: 'rose', data: trace.layers.risk },
  ];

  const verdictStyles = {
    BUY: "bg-emerald-600 text-white shadow-[0_0_20px_rgba(16,185,129,0.4)]",
    WAIT: "bg-slate-700 text-slate-300",
    AVOID: "bg-rose-600 text-white shadow-[0_0_20px_rgba(225,29,72,0.4)]",
    CAUTION: "bg-amber-600 text-white"
  };

  const getVerdictIcon = (v) => {
    if (v === 'BUY') return <CheckCircle size={20} />;
    if (v === 'AVOID') return <XCircle size={20} />;
    return <AlertTriangle size={20} />;
  };

  return (
    <div className="space-y-6">
      <div className="bg-white p-8 rounded-[3rem] border border-slate-100 shadow-sm">
        <div className="flex items-center gap-3 mb-8">
           <Info size={16} className="text-indigo-600" />
           <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">Decision Audit Pipeline</span>
        </div>

        <div className="space-y-4">
          {layers.map((layer) => (
            <div key={layer.id} className="border border-slate-100 rounded-3xl overflow-hidden shadow-sm hover:shadow-md transition-shadow">
              <button 
                onClick={() => setExpandedLayer(expandedLayer === layer.id ? null : layer.id)}
                className="w-full flex items-center justify-between p-6 bg-white hover:bg-slate-50 transition-colors"
              >
                <div className="flex items-center gap-4">
                   <div className={`p-3 bg-${layer.color}-50 text-${layer.color}-600 rounded-2xl`}>
                      {layer.icon}
                   </div>
                   <div className="text-left">
                      <h4 className="text-[11px] font-black text-slate-900 uppercase tracking-widest">{layer.name}</h4>
                      <p className="text-[10px] font-bold text-slate-500 mt-0.5">{layer.data?.summary || 'Standard processing pulse.'}</p>
                   </div>
                </div>
                <div className="flex items-center gap-6">
                   <div className="text-right">
                      <span className="block text-[8px] font-bold text-slate-400 uppercase tracking-widest mb-1">Impact</span>
                      <span className={`text-[11px] font-black text-${layer.color}-600`}>+{layer.data?.contribution?.toFixed(1) || 0} pts</span>
                   </div>
                   {expandedLayer === layer.id ? <ChevronUp size={16} className="text-slate-300" /> : <ChevronDown size={16} className="text-slate-300" />}
                </div>
              </button>

              <AnimatePresence>
                {expandedLayer === layer.id && (
                  <motion.div 
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="bg-slate-50/50 border-t border-slate-100 p-6"
                  >
                    <div className="space-y-3">
                       <span className="text-[8px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2 block">Reasoning Detail</span>
                       {layer.data?.reasoning?.map((r, i) => (
                          <div key={i} className="flex items-start gap-3">
                             <div className={`mt-1.5 w-1 h-1 rounded-full bg-${layer.color}-500 shrink-0`} />
                             <p className="text-[11px] font-bold text-slate-600 leading-relaxed">{r}</p>
                          </div>
                       ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ))}
        </div>
      </div>

      {/* FINAL SECTION */}
      <div className="bg-slate-900 p-10 rounded-[3.5rem] text-white shadow-2xl relative overflow-hidden">
         <div className="absolute top-0 right-0 p-12 opacity-5">
            <ShieldCheck size={180} />
         </div>

         <div className="relative z-10">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-8 mb-10">
               <div className="flex items-center gap-6">
                  <div className={`w-20 h-20 rounded-[2rem] flex items-center justify-center ${verdictStyles[trace.decision]}`}>
                     {getVerdictIcon(trace.decision)}
                  </div>
                  <div>
                     <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.4em] mb-2 block">System Decision</span>
                     <h2 className="text-4xl font-black tracking-tighter uppercase">{trace.decision}</h2>
                  </div>
               </div>

               <div className="p-4 bg-white/5 border border-white/10 rounded-3xl text-center min-w-[140px]">
                  <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1 block">Final Engine Score</span>
                  <span className="text-3xl font-black text-emerald-400">{trace.final_score}%</span>
               </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
               <div className="lg:col-span-8 space-y-4">
                  <div className="text-[9px] font-black text-indigo-400 uppercase tracking-[0.3em]">AI Synthesis Reasoning</div>
                  <p className="text-lg font-bold text-slate-200 leading-relaxed italic">
                    "{trace.explanation}"
                  </p>
               </div>
               
               <div className="lg:col-span-4 bg-indigo-600 p-6 rounded-[2rem] flex flex-col justify-between border border-indigo-400/30">
                  <div className="text-[9px] font-black text-indigo-200 uppercase tracking-widest mb-4">Suggested Action</div>
                  <div className="flex items-center justify-between">
                     <span className="text-xl font-black uppercase">{trace.action}</span>
                     <ArrowRight size={24} className="text-white/50" />
                  </div>
               </div>
            </div>

            <div className="mt-12 pt-8 border-t border-white/5 flex items-center gap-4">
               <ShieldCheck size={12} className="text-emerald-500" />
               <span className="text-[8px] font-bold text-slate-500 uppercase tracking-[0.3em]">Decision deterministic & explainable. Verified for audit protocol.</span>
            </div>
         </div>
      </div>
    </div>
  );
}
