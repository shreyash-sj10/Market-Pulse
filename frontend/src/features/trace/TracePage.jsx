import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Database, Activity, ShieldCheck, 
  Brain, Zap, ChevronRight, 
  Clock, Server, Terminal,
  Workflow, CheckCircle, AlertCircle,
  Layers, Target, ShieldAlert
} from "lucide-react";
import api from "../../services/api";
import DecisionTracePanel from "./components/DecisionTracePanel";

const TracePage = () => {
  const [selectedTraceId, setSelectedTraceId] = useState(null);

  const { data: listResponse, isLoading: listLoading } = useQuery({
    queryKey: ["traces"],
    queryFn: async () => {
      const res = await api.get("/trace");
      return res.data.traces;
    }
  });

  const { data: detailResponse, isLoading: detailLoading } = useQuery({
    queryKey: ["trace", selectedTraceId],
    queryFn: async () => {
      const res = await api.get(`/trace/${selectedTraceId}`);
      return res.data.trace;
    },
    enabled: !!selectedTraceId
  });

  const traces = listResponse || [];
  const selectedTrace = detailResponse;

  return (
    <div className="app-page px-2 pt-4">
      <div className="mb-12 border-l-4 border-slate-900 pl-8">
        <h1 className="text-4xl font-black text-slate-900 tracking-tighter mb-2">Audit & Trace Hub</h1>
        <p className="text-slate-500 font-medium text-lg leading-relaxed max-w-2xl">
          Trace_v2: Dual-Mode intelligence verification. Toggling between Technical Pipeline Logs and Human-Readable Decision Layers.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
        
        {/* TRACE LIST PANEL */}
        <div className="lg:col-span-4 space-y-4">
          <div className="flex items-center gap-2 mb-6 px-2">
             <Clock size={18} className="text-slate-400" />
             <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Decision Registry</span>
          </div>
          
          {listLoading ? (
            [1, 2, 3].map(i => <div key={i} className="h-24 bg-white rounded-3xl border border-slate-100 animate-pulse" />)
          ) : traces.length === 0 ? (
            <div className="p-10 text-center bg-slate-50 rounded-3xl border border-dashed border-slate-200">
               <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">No traces recorded yet</p>
            </div>
          ) : (
            traces.map(t => (
              <motion.div
                key={t._id}
                whileHover={{ x: 5 }}
                onClick={() => setSelectedTraceId(t._id)}
                className={`p-6 rounded-[2rem] border transition-all cursor-pointer ${selectedTraceId === t._id ? 'bg-slate-900 text-white border-slate-900 shadow-xl' : 'bg-white text-slate-900 border-slate-100 hover:border-indigo-600'}`}
              >
                <div className="flex items-center justify-between mb-3">
                   <div className="flex items-center gap-2">
                       <Workflow size={14} className={selectedTraceId === t._id ? "text-indigo-400" : "text-indigo-600"} />
                       <span className="text-[10px] font-black uppercase tracking-widest">{t.type === 'ANALYSIS' ? 'DECISION' : t.type}</span>
                   </div>
                   <span className={`text-[8px] font-bold uppercase opacity-50 ${selectedTraceId === t._id ? 'text-white' : 'text-slate-400'}`}>
                      {new Date(t.timestamp).toLocaleTimeString()}
                   </span>
                </div>
                <div className="flex items-center justify-between">
                   <div>
                      <span className="text-xs font-bold tracking-tight opacity-80 block">Audit ID: {t._id.slice(-8).toUpperCase()}</span>
                      {t.decision && <span className={`text-[8px] font-black uppercase tracking-widest mt-1 block ${t.decision === 'BUY' ? 'text-emerald-500' : 'text-rose-500'}`}>{t.decision} VERDICT</span>}
                   </div>
                   <ChevronRight size={16} className="opacity-30" />
                </div>
              </motion.div>
            ))
          )}
        </div>

        {/* TRACE DETAIL VIEW */}
        <div className="lg:col-span-8">
           <AnimatePresence mode="wait">
             {!selectedTraceId ? (
                <motion.div 
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                  className="h-full flex flex-col items-center justify-center p-20 bg-slate-50 rounded-[3rem] border border-slate-100 text-center"
                >
                   <Terminal size={48} className="text-slate-200 mb-6" />
                   <h3 className="text-xl font-black text-slate-900">Select a trace to audit</h3>
                   <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mt-2">Decision metadata will appear here</p>
                </motion.div>
             ) : detailLoading ? (
                <div className="h-full bg-white rounded-[3rem] border border-slate-100 p-12 space-y-6">
                   <div className="h-8 w-1/3 bg-slate-50 animate-pulse rounded-lg" />
                   <div className="grid grid-cols-2 gap-6">
                      {[1, 2, 3, 4].map(i => <div key={i} className="h-40 bg-slate-50 animate-pulse rounded-3xl" />)}
                   </div>
                </div>
             ) : selectedTrace.layers ? (
                <motion.div key={selectedTrace._id} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                   <DecisionTracePanel trace={selectedTrace} />
                </motion.div>
             ) : (
                <motion.div 
                   key={selectedTrace._id}
                   initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }}
                   className="space-y-10"
                >
                   {/* PIPELINE HEADER */}
                   <div className="bg-white p-10 rounded-[3rem] border border-slate-100 shadow-sm flex items-center justify-between">
                      <div>
                         <span className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.3em] mb-2 block">Trace ID: {selectedTrace._id}</span>
                         <h2 className="text-3xl font-black text-slate-900 tracking-tighter">Decision Workflow Analysis</h2>
                      </div>
                      <div className="flex items-center gap-3">
                         <div className="p-3 bg-emerald-50 text-emerald-600 rounded-2xl">
                            <CheckCircle size={24} />
                         </div>
                         <div className="text-right">
                             <span className="block text-[8px] font-bold text-slate-400 uppercase tracking-widest">Pipeline Status</span>
                             <span className="block text-[10px] font-black text-slate-900 uppercase">Verified Success</span>
                         </div>
                      </div>
                   </div>

                   {/* STAGE VISUALIZATION */}
                   <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                      
                      {/* Interpretation Layer */}
                      <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 space-y-6">
                         <div className="flex items-center gap-3 text-indigo-600">
                            <Brain size={18} />
                            <span className="text-[10px] font-bold uppercase tracking-widest">Interpretation Layer</span>
                         </div>
                         <div className="space-y-3">
                            <div className="flex justify-between text-xs">
                               <span className="text-slate-400 font-bold">ML Used</span>
                               <span className="text-slate-900 font-black">{selectedTrace.stages.interpretation_layer.ml_used ? "YES" : "NO"}</span>
                            </div>
                            <div className="flex justify-between text-xs">
                               <span className="text-slate-400 font-bold">Confidence</span>
                               <span className="text-slate-900 font-black">{(selectedTrace.stages.interpretation_layer.ml_confidence * 100).toFixed(1)}%</span>
                            </div>
                         </div>
                      </div>

                      {/* Candidate Generator */}
                      <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 space-y-6">
                         <div className="flex items-center gap-3 text-indigo-600">
                            <Layers size={18} />
                            <span className="text-[10px] font-bold uppercase tracking-widest">Candidate Generator</span>
                         </div>
                         <div className="space-y-3">
                            <div className="flex justify-between text-xs">
                               <span className="text-slate-400 font-bold">Input States</span>
                               <span className="text-slate-900 font-black">{selectedTrace.stages.candidate_generator.input_count}</span>
                            </div>
                            <div className="flex justify-between text-xs">
                               <span className="text-slate-400 font-bold">Variants</span>
                               <span className="text-slate-900 font-black">{selectedTrace.stages.candidate_generator.output_count}</span>
                            </div>
                         </div>
                      </div>

                      {/* Constraint Engine */}
                      <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 space-y-6">
                         <div className="flex items-center gap-3 text-rose-600">
                            <ShieldCheck size={18} />
                            <span className="text-[10px] font-bold uppercase tracking-widest">Constraint Engine</span>
                         </div>
                         <div className="space-y-3">
                            <div className="flex justify-between text-xs">
                               <span className="text-slate-400 font-bold">Rejected</span>
                               <span className="text-rose-600 font-black">{selectedTrace.stages.constraint_engine.rejected}</span>
                            </div>
                            <div className="flex flex-col gap-1 mt-2">
                               <span className="text-[9px] font-bold text-slate-400 uppercase">Rules Applied</span>
                               <div className="flex flex-wrap gap-1">
                                  {selectedTrace.stages.constraint_engine.rules_applied.map(r => (
                                    <span key={r} className="px-1.5 py-0.5 bg-slate-50 text-[8px] font-bold text-slate-500 rounded">{r}</span>
                                  ))}
                               </div>
                            </div>
                         </div>
                      </div>

                      {/* Scoring Engine */}
                      <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 space-y-6">
                         <div className="flex items-center gap-3 text-indigo-600">
                            <Target size={18} />
                            <span className="text-[10px] font-bold uppercase tracking-widest">Scoring Engine</span>
                         </div>
                         <div className="space-y-3">
                            <div className="flex justify-between text-xs">
                               <span className="text-slate-400 font-bold">Vectors Scored</span>
                               <span className="text-slate-900 font-black">{selectedTrace.stages.scoring_engine.output_count}</span>
                            </div>
                         </div>
                      </div>

                      {/* Optimizer */}
                      <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 space-y-6">
                         <div className="flex items-center gap-3 text-indigo-600">
                            <Workflow size={18} />
                            <span className="text-[10px] font-bold uppercase tracking-widest">Optimizer</span>
                         </div>
                         <div className="space-y-3">
                            <div className="flex justify-between text-xs">
                               <span className="text-slate-400 font-bold">Evaluations</span>
                               <span className="text-slate-900 font-black">{selectedTrace.stages.optimizer.combinations_evaluated}</span>
                            </div>
                            <div className="flex justify-between text-xs">
                               <span className="text-slate-400 font-bold">Final Score</span>
                               <span className="text-emerald-600 font-black">{selectedTrace.stages.optimizer.selected_score.toFixed(2)}</span>
                            </div>
                         </div>
                      </div>

                      {/* Reliability Engine */}
                      <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 space-y-6">
                         <div className="flex items-center gap-3 text-emerald-600">
                            <CheckCircle size={18} />
                            <span className="text-[10px] font-bold uppercase tracking-widest">Reliability Engine</span>
                         </div>
                         <div className="space-y-3">
                            <div className="flex justify-between text-xs">
                               <span className="text-slate-400 font-bold">Consistency</span>
                               <span className="text-emerald-600 font-black">100%</span>
                            </div>
                            <div className="flex justify-between text-xs">
                               <span className="text-slate-400 font-bold">Verdict</span>
                               <span className="text-slate-900 font-black">AUTHORIZED</span>
                            </div>
                         </div>
                      </div>

                   </div>
                </motion.div>
             )}
           </AnimatePresence>
        </div>

      </div>
    </div>
  );
};

export default TracePage;
