import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  TrendingUp,
  TrendingDown,
  ShieldCheck,
  Activity,
  Target,
  Brain,
  Zap,
  ArrowRight,
  TrendingDown as SellIcon
} from "lucide-react";
import { getPortfolioSummary, getPositions } from "../../services/portfolio.api";
import { getTradeHistory } from "../../services/trade.api";
import { formatINR } from "../../utils/currency.utils";
import toast from "react-hot-toast";
import { useNavigate } from "react-router-dom";
import PortfolioNews from "../../components/market/PortfolioNews";
import { getPreTradeGuard } from "../../services/intelligence.api";
import { executeTrade } from "../../services/trade.api";
import { AlertTriangle, CheckCircle2, X } from "lucide-react";

const Dashboard = () => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [isSelling, setIsSelling] = useState(false);


  // Core Data Queries
  const { data: summaryResponse, isLoading: summaryLoading } = useQuery({
    queryKey: ["portfolio"],
    queryFn: getPortfolioSummary,
    refetchInterval: 30000,
  });

  const { data: posResponse, isLoading: posLoading } = useQuery({
    queryKey: ["positions"],
    queryFn: getPositions,
    refetchInterval: 30000,
  });

  const { data: tradesResponse } = useQuery({
    queryKey: ["trades"],
    queryFn: () => getTradeHistory(1, 8),
  });

  const summary = summaryResponse?.data;

  const positions = posResponse?.positions || [];
  const trades = tradesResponse?.trades || [];

  const [selectedSellPos, setSelectedSellPos] = useState(null);
  const [sellQuantity, setSellQuantity] = useState(0);
  const [isProcessingSell, setIsProcessingSell] = useState(false);

  const handleSellNavigate = (pos) => {
    setSelectedSellPos(pos);
    setSellQuantity(pos.quantity);
  };

  const handleQuickSell = async () => {
    if (!selectedSellPos || sellQuantity <= 0) return;
    
    setIsProcessingSell(true);
    const toastId = toast.loading(`Liquidation protocol initiated for ${selectedSellPos.symbol}...`);
    
    try {
      // 1. Silent Background Audit (Req'd for Token)
      const audit = await getPreTradeGuard({
        symbol: selectedSellPos.symbol,
        quantity: sellQuantity,
        price: selectedSellPos.currentPricePaise,
        side: "SELL",
        userThinking: "Direct portfolio liquidation via dashboard."
      });

      // 2. Direct Execution
      await executeTrade({
        symbol: selectedSellPos.symbol,
        type: "SELL",
        quantity: parseInt(sellQuantity),
        pricePaise: selectedSellPos.currentPricePaise,
        preTradeToken: audit.token,
        decisionContext: audit.snapshot,
        userThinking: "Direct portfolio liquidation via dashboard.",
        idempotencyKey: `quick-exit-${selectedSellPos.symbol}-${Date.now()}`
      });

      toast.success("Position successfully liquidated.", { id: toastId });
      setSelectedSellPos(null);
      
      // MASTER CACHE SYNC: Cascade refresh across all institutional layers
      queryClient.invalidateQueries(["portfolio"]);
      queryClient.invalidateQueries(["positions"]);
      queryClient.invalidateQueries(["trades"]);
      queryClient.invalidateQueries(["tradeHistory"]); // Journal entry
      queryClient.invalidateQueries(["adaptive-profile"]); // DNA
    } catch (err) {
      toast.error(err.response?.data?.message || "Liquidation failed.", { id: toastId });
    } finally {
      setIsProcessingSell(false);
    }
  };


  if (summaryLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-4">
          <Activity size={40} className="text-slate-900 animate-pulse" />
          <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Synchronizing Master Ledger...</span>
        </div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="app-page px-2 pt-4"
    >
      {/* ── HEADER ── */}
      <header className="mb-12 flex flex-col md:flex-row md:items-end justify-between gap-6 px-2">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-1.5 h-1.5 rounded-full bg-indigo-600 animate-pulse" />
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">Live Master Terminal</span>
          </div>
          <h1 className="text-5xl font-black text-slate-900 tracking-tight">Executive Dashboard</h1>
        </div>
        <div className="flex items-center gap-4">
          <div className="px-6 py-4 bg-white border border-slate-100 rounded-2xl shadow-sm">
            <span className="block text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">Tradable Liquidity</span>
            <span className="text-xl font-black text-slate-900">{formatINR(summary?.balance || 0)}</span>
          </div>
        </div>
      </header>

      {/* ── HIGHLIGHT METRICS ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
        <div className="bg-slate-900 p-10 rounded-[2.5rem] text-white flex flex-col justify-between min-h-[220px] shadow-xl shadow-slate-900/40">
          <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500 mb-4 block">Net Equity (Cash + Assets)</span>
          <div>
            <h2 className="text-4xl font-black tracking-tighter mb-2">
              {formatINR(summary?.netEquity || 0)}
            </h2>
            <p className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest flex items-center gap-2">
              <Zap size={10} /> Live Snapshot
            </p>
          </div>
        </div>

        <div className="bg-white p-10 rounded-[2.5rem] border border-slate-100 flex flex-col justify-between">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">Realized P&L</span>
          <div>
            <h2 className={`text-3xl font-black tracking-tighter ${summary?.realizedPnL >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
              {summary?.realizedPnL >= 0 ? "+" : ""}{formatINR(summary?.realizedPnL || 0)}
            </h2>
          </div>
        </div>

        <div className="bg-white p-10 rounded-[2.5rem] border border-slate-100 flex flex-col justify-between">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">Unrealized P&L</span>
          <h2 className={`text-3xl font-black tracking-tighter ${summary?.unrealizedPnL >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
            {summary?.unrealizedPnL >= 0 ? "+" : ""}{formatINR(summary?.unrealizedPnL || 0)}
          </h2>
        </div>

        <div className="bg-white p-10 rounded-[2.5rem] border border-slate-100 flex flex-col justify-between">
          <div className="flex justify-between items-start">
             <span className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">Institutional Skill</span>
             <span className={`text-[8px] font-black px-2 py-0.5 rounded-full ${summary?.skillAudit?.trend === 'IMPROVING' ? 'bg-emerald-500 text-white' : 'bg-slate-200 text-slate-600'}`}>{summary?.skillAudit?.trend || 'STABLE'}</span>
          </div>
          <div>
            <h2 className="text-3xl font-black text-slate-900 tracking-tighter">
              {summary?.skillAudit?.score || "0"}<span className="text-xs text-slate-400">/100</span>
            </h2>
            <span className="text-[8px] font-black text-indigo-600 uppercase tracking-widest">{summary?.skillAudit?.level || 'EVALUATING'}</span>
          </div>
        </div >

        <div className="bg-white p-10 rounded-[2.5rem] border border-slate-100 flex flex-col justify-between">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">Success Rate</span>
          <h2 className="text-3xl font-black text-slate-900 tracking-tighter">
            {summary?.winRate || "0"}%
          </h2>
        </div >
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">

        {/* ── LEFT: PORTFOLIO & HISTORY ── */}
        <div className="lg:col-span-8 space-y-10">

          {/* MY PORTFOLIO (Dominant Section) */}
          <div className="bg-white rounded-[3rem] p-12 border border-slate-100 shadow-sm">
            <div className="flex items-center justify-between mb-10">
              <div className="flex flex-col">
                <h3 className="text-lg font-black text-slate-900 tracking-tight">My Live Portfolio</h3>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Real-time valuation analytics</span>
              </div>
              <button
                onClick={() => navigate("/trade")}
                className="flex items-center gap-2 px-5 py-2.5 bg-indigo-50 text-indigo-600 rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-indigo-600 hover:text-white transition-all"
              >
                Open Terminal <ArrowRight size={14} />
              </button>
            </div>

            {posLoading ? (
              <div className="space-y-4">
                <div className="h-20 bg-slate-50 rounded-2xl animate-pulse" />
                <div className="h-20 bg-slate-50 rounded-2xl animate-pulse" />
              </div>
            ) : positions.length === 0 ? (
              <div className="py-24 text-center bg-slate-50 rounded-3xl border border-dashed border-slate-200">
                <p className="text-sm font-bold text-slate-400 italic">No active positions in current cycle.</p>
                <button
                  onClick={() => navigate("/market")}
                  className="mt-6 text-[10px] font-black text-indigo-600 uppercase tracking-widest hover:underline"
                >
                  Browse Market explorer
                </button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="text-[9px] font-bold text-slate-400 uppercase tracking-[0.2em] border-b border-slate-100">
                    <tr>
                      <th className="pb-6">Asset</th>
                      <th className="pb-6 text-right">Quantity</th>
                      <th className="pb-6 text-right">MKT Price</th>
                      <th className="pb-6 text-right">Return (P&L)</th>
                      <th className="pb-6 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {positions.map((pos) => (
                      <tr key={pos.symbol} className="group hover:bg-slate-50/50 transition-colors">
                        <td className="py-8 font-black text-slate-900 uppercase tracking-tight">{pos.symbol}</td>
                        <td className="py-8 text-right font-bold text-slate-700">{pos.quantity}</td>
                        <td className="py-8 text-right font-bold text-indigo-600">{formatINR(pos.currentPricePaise)}</td>
                        <td className="py-8 text-right">
                          <span className={`font-black tracking-tighter ${pos.unrealizedPnL >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                            {pos.unrealizedPnL >= 0 ? "+" : ""}{formatINR(pos.unrealizedPnL)}
                            <span className="block text-[8px] opacity-70">({pos.pnlPct}%)</span>
                          </span>
                        </td>

                        <td className="py-8 text-center">
                          <button
                            onClick={() => handleSellNavigate(pos)}
                            className="p-3 bg-rose-50 text-rose-600 rounded-xl hover:bg-rose-600 hover:text-white transition-all shadow-sm"
                          >
                            <SellIcon size={16} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* ⚡ QUICK SELL MODAL ⚡ */}
          <AnimatePresence>
            {selectedSellPos && (
              <div className="fixed inset-0 z-50 flex items-center justify-center p-6 sm:p-0">
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  onClick={() => !isProcessingSell && setSelectedSellPos(null)}
                  className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
                />
                
                <motion.div 
                  initial={{ scale: 0.95, opacity: 0, y: 20 }}
                  animate={{ scale: 1, opacity: 1, y: 0 }}
                  exit={{ scale: 0.95, opacity: 0, y: 20 }}
                  className="relative w-full max-w-md bg-white rounded-[2.5rem] shadow-2xl overflow-hidden"
                >
                  <div className="p-10 space-y-8">
                    <div className="flex items-center justify-between">
                       <div className="flex items-center gap-3">
                          <div className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
                          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Liquidation Node</span>
                       </div>
                       <button onClick={() => setSelectedSellPos(null)} className="text-slate-400 hover:text-slate-900">
                          <X size={20} />
                       </button>
                    </div>

                    <div className="space-y-2">
                       <h2 className="text-3xl font-black text-slate-900 tracking-tight">Exit {selectedSellPos.symbol.replace('.NS','')}</h2>
                       <p className="text-slate-500 text-sm font-medium">Verify liquidation volume before authorizing execution.</p>
                    </div>

                    <div className="p-8 bg-slate-50 rounded-3xl space-y-4">
                       <div className="flex justify-between items-center text-[10px] font-black uppercase text-slate-400 tracking-widest">
                          <span>Quantity to Sell</span>
                          <span className="text-slate-900">Max: {selectedSellPos.quantity}</span>
                       </div>
                       <input 
                          type="number"
                          value={sellQuantity}
                          onChange={(e) => setSellQuantity(Math.min(selectedSellPos.quantity, Math.max(0, parseInt(e.target.value) || 0)))}
                          className="w-full bg-transparent text-4xl font-black text-slate-900 outline-none border-b-2 border-slate-200 focus:border-rose-500 py-2 transition-all"
                       />
                       <div className="flex justify-between items-center">
                          <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Est. Proceeds</span>
                          <span className="text-lg font-black text-emerald-600">{formatINR(sellQuantity * selectedSellPos.currentPricePaise)}</span>
                       </div>
                    </div>

                    <div className="flex items-start gap-3 p-4 bg-amber-50 rounded-2xl border border-amber-100">
                       <AlertTriangle size={18} className="text-amber-600 shrink-0 mt-0.5" />
                       <p className="text-[11px] font-bold text-amber-800 leading-relaxed">
                          Authorizing this will execute an immediate market-sell. The institutional audit will be bypassed manually via direct terminal override.
                       </p>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                       <button 
                         onClick={() => setSelectedSellPos(null)}
                         disabled={isProcessingSell}
                         className="py-4 bg-slate-100 text-slate-900 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-200 transition-all disabled:opacity-50"
                       >
                         Abort
                       </button>
                       <button 
                         onClick={handleQuickSell}
                         disabled={isProcessingSell || sellQuantity <= 0}
                         className="py-4 bg-rose-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-rose-700 shadow-xl shadow-rose-200 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                       >
                         {isProcessingSell ? <Activity size={14} className="animate-spin" /> : <ShieldCheck size={14} />}
                         {isProcessingSell ? "Syncing..." : "Confirm Exit"}
                       </button>
                    </div>
                  </div>
                </motion.div>
              </div>
            )}
          </AnimatePresence>

          {/* PORTFOLIO IMPACT NEWS */}
          <div className="mt-10">
            <PortfolioNews />
          </div>

          {/* RECENT REGISTRY */}
          <div className="bg-white rounded-[3rem] border border-slate-100 shadow-sm overflow-hidden">
            <div className="px-12 py-8 bg-slate-50/50 flex items-center justify-between border-b border-slate-100">
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-[0.2em]">Execution Registry</h3>
              <div className="px-3 py-1 bg-white rounded-full border border-slate-200 text-[8px] font-bold text-slate-400 uppercase">Latency-Free Sync</div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <tbody className="divide-y divide-slate-50">
                  {trades.map((trade) => (
                    <tr key={trade.id} className="group hover:bg-slate-50/30 transition-colors">
                      <td className="px-12 py-6">
                        <span className="font-black text-slate-900 text-sm">{trade.symbol.replace(".NS", "")}</span>
                        <span className="block text-[10px] font-bold text-slate-400 tracking-widest">{trade.type}</span>
                      </td>
                      <td className="px-12 py-6 text-right">
                        <span className="font-bold text-slate-900 text-sm">{formatINR(trade.totalValue)}</span>
                        <span className="block text-[9px] font-medium text-slate-400">{trade.quantity} @ {formatINR(trade.price)}</span>
                      </td>
                      <td className="px-12 py-6 text-right">
                        <div className={`inline-block px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-wider ${trade.analysis?.riskScore > 70 ? 'bg-rose-50 text-rose-600' : 'bg-emerald-50 text-emerald-600'}`}>
                          Risk: {trade.analysis?.riskScore?.toFixed(0) || 50}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* ── RIGHT: INTELLIGENCE ── */}
        <div className="lg:col-span-4">
          <div className="bg-slate-50 rounded-[3rem] p-8 border border-slate-100 sticky top-6 flex flex-col h-[calc(100vh-120px)] shadow-sm">
            <div className="flex items-center justify-between mb-8 px-2">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-white rounded-2xl shadow-sm border border-slate-100">
                  <Brain size={20} className="text-slate-900" />
                </div>
                <h3 className="text-lg font-black tracking-tight text-slate-900">Psych Audit</h3>
              </div>
              <div className="px-3 py-1 bg-white rounded-full border border-slate-100 text-[8px] font-black text-slate-400 uppercase tracking-widest">
                V1.0
              </div>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar space-y-4 pr-1">
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest px-2 block mb-4">Tactical Log</span>

              {summary?.behaviorInsights?.recentBehaviors?.length > 0 ? (
                summary.behaviorInsights.recentBehaviors.map((item, i) => (
                  <motion.div
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.05 }}
                    key={`${item.symbol}-${item.timestamp}-${i}`}
                    className="p-6 bg-white rounded-[2rem] border border-slate-100 shadow-sm hover:border-indigo-200 transition-all group"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                        <span className="text-[10px] font-black text-slate-900 uppercase tracking-widest">{item.symbol.replace(".NS", "")}</span>
                      </div>
                      <span className="text-[8px] font-bold text-slate-300 uppercase tracking-tighter">
                        {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 leading-snug font-medium line-clamp-2">
                      {item.behavior}
                    </p>
                  </motion.div>
                ))
              ) : (
                <div className="p-10 text-center bg-white/50 rounded-3xl border border-dashed border-slate-200">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">Observing session...</p>
                </div>
              )}

              {/* ── INSIGHT TRANSPARENCY PANEL ── */}
              {summary?.behaviorInsights?.success && (
                <div className="pt-6 border-t border-slate-200/60 mt-8 space-y-6">
                  <details className="group">
                    <summary className="flex items-center justify-between cursor-pointer list-none py-2 hover:bg-white rounded-xl px-2 transition-all">
                      <div className="flex items-center gap-2">
                        <Activity size={12} className="text-slate-400" />
                        <span className="text-[9px] font-black text-slate-900 uppercase tracking-[0.2em]">Why this insight?</span>
                      </div>
                      <span className="text-indigo-600 text-[10px] font-bold uppercase transition-transform group-open:rotate-180">▼</span>
                    </summary>

                    <div className="mt-6 space-y-8 animate-in fade-in slide-in-from-top-2 duration-300">
                      {/* Patterns Evidence */}
                      <div className="space-y-3">
                        <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest px-1 block">Pattern Evidence</span>
                        {summary.behaviorInsights.patterns?.map((p, index) => (
                          <div key={`${p.name}-${index}`} className="bg-white p-5 rounded-3xl border border-slate-100 space-y-3 shadow-sm">
                            <div className="flex justify-between items-center">
                              <div className="flex flex-col">
                                <span className="text-[10px] font-black text-slate-900">{p.name}</span>
                                <span className="text-[8px] font-bold text-slate-400 uppercase tracking-tighter mt-0.5">{p.severity} SEVERITY</span>
                              </div>
                              <div className="text-right">
                                <span className="text-lg font-black text-slate-900 leading-none">{p.confidence}%</span>
                                <span className="text-[6px] font-bold text-slate-400 uppercase block">Conf</span>
                              </div>
                            </div>
                            <div className="h-1.5 bg-slate-50 rounded-full overflow-hidden">
                              <motion.div
                                initial={{ width: 0 }} animate={{ width: `${p.confidence}%` }}
                                className={`h-full ${p.severity === 'CRITICAL' ? 'bg-rose-500' : 'bg-indigo-500'}`}
                              />
                            </div>
                            <div className="flex justify-between items-center text-[8px] font-bold text-slate-400 uppercase">
                              <span>Matches: {p.evidence?.matches || 0}</span>
                              <span>Total Ops: {p.evidence?.opportunities || 0}</span>
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Progression Context */}
                      {summary.behaviorInsights.progression && (
                        <div className="space-y-3">
                          <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest px-1 block">Macro Trend</span>
                          <div className="bg-slate-900 p-6 rounded-[2rem] text-white shadow-xl">
                            <div className="flex items-center justify-between mb-4">
                              <span className="text-[9px] font-bold uppercase tracking-widest text-slate-500">Status</span>
                              <span className={`text-[8px] font-black px-2 py-0.5 rounded-full ${summary.behaviorInsights.progression.trend === 'IMPROVING' ? 'bg-emerald-500 text-white' : 'bg-rose-500 text-white'}`}>
                                {summary.behaviorInsights.progression.trend}
                              </span>
                            </div>
                            <div className="space-y-3">
                              {summary.behaviorInsights.progression.changes?.map((c, index) => (

                                <div key={`${c.metric}-${index}`} className="flex items-center justify-between">
                                  <span className="text-[8px] font-bold text-slate-400 uppercase">{c.metric}</span>
                                  <span className={`text-[10px] font-black ${c.status === 'IMPROVED' ? 'text-emerald-400' : 'text-rose-400'}`}>
                                    {c.direction === 'UP' ? '↑' : '↓'} {c.magnitude}%
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </details>
                </div>
              )}
            </div>

            <div className="pt-8 mt-4 border-t border-slate-200/60">
              <button
                onClick={() => navigate("/trade")}
                className="w-full py-4 bg-slate-900 text-white hover:bg-black rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] transition-all shadow-xl shadow-slate-900/10"
              >
                Generate Alpha Plan
              </button>
            </div>
          </div>
        </div>


      </div>


    </motion.div>
  );
};

export default Dashboard;
