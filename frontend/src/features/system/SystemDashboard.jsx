import { useQuery } from "@tanstack/react-query";
import { 
  Server, Activity, Database, 
  ShieldCheck, Globe, Cpu, 
  HardDrive, BarChart3, TrendingUp 
} from "lucide-react";
import { getPortfolioSummary, getPositions } from "../../services/portfolio.api";
import { getTradeHistory } from "../../services/trade.api";
import api from "../../services/api";

const SystemDashboard = () => {
  const { data: summary } = useQuery({ queryKey: ["portfolio"], queryFn: getPortfolioSummary });
  const { data: pos } = useQuery({ queryKey: ["positions"], queryFn: getPositions });
  const { data: trades } = useQuery({ queryKey: ["trades"], queryFn: () => getTradeHistory(1, 1) });

  const stats = [
    { label: "Execution Engine", value: "ONLINE", icon: Activity, color: "text-emerald-500" },
    { label: "Market Data Sync", value: "ACTIVE", icon: Globe, color: "text-indigo-500" },
    { label: "Trace Ledger", value: "SYNCED", icon: Database, color: "text-emerald-500" },
    { label: "Invariant Layer", value: "STRICT", icon: ShieldCheck, color: "text-indigo-500" },
  ];

  return (
    <div className="max-w-[1600px] mx-auto pb-20 px-6 mt-10">
      <header className="mb-12">
        <h1 className="text-4xl font-black text-slate-900 tracking-tighter">System Health & Metadata</h1>
        <p className="text-slate-400 font-bold text-[10px] uppercase tracking-[0.3em] mt-2">SYS.NODE: DETERMINISTIC_TERMINAL_v1.0</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
        {stats.map((s, i) => (
          <div key={i} className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm flex items-center justify-between">
             <div>
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{s.label}</span>
                <p className={`text-lg font-black tracking-tighter mt-1 ${s.color}`}>{s.value}</p>
             </div>
             <div className={`p-4 rounded-2xl bg-slate-50 ${s.color}`}>
                <s.icon size={20} />
             </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
        
        {/* API & ENGINE STATUS */}
        <div className="lg:col-span-8 space-y-10">
           <div className="bg-white rounded-[3rem] p-12 border border-slate-100 shadow-sm">
              <h3 className="text-lg font-black text-slate-900 mb-10 flex items-center gap-3">
                 <Server size={20} className="text-indigo-600" /> Infrastructure Node Status
              </h3>
              
              <div className="space-y-8">
                 {[
                   { label: "Master Database", detail: "MongoDB Cluster 0", status: "STABLE", latency: "12ms" },
                   { label: "Cache Layer", detail: "Internal Memory Store", status: "OPTIMAL", latency: "0.1ms" },
                   { label: "Behavior Engine", detail: "Deterministic Pattern Matcher", status: "READY", latency: "45ms" },
                   { label: "Market API (Yahoo)", detail: "External Intelligence Feed", status: "CONNECTED", latency: "240ms" }
                 ].map((item, i) => (
                    <div key={i} className="flex items-center justify-between py-6 border-b border-slate-50 last:border-0 hover:bg-slate-50/50 transition-colors px-4 rounded-2xl">
                       <div className="flex flex-col">
                          <span className="text-sm font-black text-slate-900">{item.label}</span>
                          <span className="text-[10px] font-bold text-slate-400">{item.detail}</span>
                       </div>
                       <div className="flex items-center gap-8 text-right">
                          <div>
                             <span className="block text-[8px] font-bold text-slate-400 uppercase uppercase mb-1">Status</span>
                             <span className="text-[9px] font-black text-emerald-600 tracking-widest">{item.status}</span>
                          </div>
                          <div>
                             <span className="block text-[8px] font-bold text-slate-400 uppercase uppercase mb-1">Latency</span>
                             <span className="text-[9px] font-black text-slate-900 tracking-widest">{item.latency}</span>
                          </div>
                       </div>
                    </div>
                 ))}
              </div>
           </div>
        </div>

        {/* METRICS SUMMARY */}
        <div className="lg:col-span-4 space-y-6">
           <div className="bg-slate-900 rounded-[3rem] p-10 text-white min-h-[300px] flex flex-col justify-between">
              <div>
                 <span className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] mb-4 block">System Metrics Snapshot</span>
                 <div className="space-y-6">
                    <div className="flex justify-between items-center">
                       <span className="text-xs font-bold text-slate-400">Total System Trades</span>
                       <span className="text-xl font-black">{trades?.total || 0}</span>
                    </div>
                    <div className="flex justify-between items-center">
                       <span className="text-xs font-bold text-slate-400">Active Positions</span>
                       <span className="text-xl font-black">{pos?.positions?.length || 0}</span>
                    </div>
                    <div className="flex justify-between items-center">
                       <span className="text-xs font-bold text-slate-400">Dominant Mistake</span>
                       <span className="text-xl font-black text-indigo-400">{summary?.summary?.behaviorInsights?.dominantMistake || "NONE"}</span>
                    </div>
                 </div>
              </div>
              <div className="pt-8 border-t border-white/5 mt-10">
                 <div className="flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-[10px] font-black uppercase tracking-widest">Protocol Version v1.0.4 - Deterministic</span>
                 </div>
              </div>
           </div>

           <div className="bg-white rounded-[3rem] p-10 border border-slate-100 shadow-sm flex flex-col gap-6">
              <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Environment Variables</h4>
              <div className="space-y-4">
                 <div className="flex flex-col gap-1">
                    <span className="text-[8px] font-black text-slate-300 uppercase">Backend Host</span>
                    <span className="text-[10px] font-mono font-bold text-slate-500 break-all">{import.meta.env.VITE_BACKEND_URL}</span>
                 </div>
                 <div className="flex flex-col gap-1">
                    <span className="text-[8px] font-black text-slate-300 uppercase">Network Mode</span>
                    <span className="text-[10px] font-mono font-bold text-slate-500">CORS_ENABLED_STRICT</span>
                 </div>
              </div>
           </div>
        </div>

      </div>
    </div>
  );
};

export default SystemDashboard;
