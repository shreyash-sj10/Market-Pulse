import { motion, AnimatePresence } from "framer-motion";
import {
  ShieldCheck,
  Activity,
  ArrowRight,
  TrendingDown as SellIcon,
  AlertTriangle,
  X,
  Wallet,
  Briefcase,
  Percent,
  ListChecks,
} from "lucide-react";
import { formatINR } from "../../utils/currency.utils";
import { ErrorState } from "../../components/common/ExperienceStates";
import { useNavigate } from "react-router-dom";
import PortfolioNews from "../../components/market/PortfolioNews";
import { usePortfolio } from "../../hooks/usePortfolio";

const Dashboard = () => {
  const navigate = useNavigate();
  const MotionDiv = motion.div;
  const { summary, positions, trades, portfolioNews, quickSell } = usePortfolio();

  if (summary.isError || positions.isError) {
    return <ErrorState onRetry={() => { summary.refetch(); positions.refetch(); }} />;
  }

  const summaryState = summary.state;
  const summaryData = summary.data;
  const portfolioState = positions.state;
  const positionList = positions.list;
  const recentTrades = trades.list;
  const selectedSellPos = quickSell.selectedSellPos;
  const sellQuantity = quickSell.sellQuantity;
  const isProcessingSell = quickSell.isProcessing;

  if (summary.isLoading) {
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
    <MotionDiv initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="app-page px-2 pt-4">
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
            <span className="text-xl font-black text-slate-900">{formatINR(summaryData?.balancePaise || 0)}</span>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
        {[
          {
            label: "Portfolio Value",
            value: formatINR(summaryData?.totalValuePaise || 0),
            tone: "bg-slate-900 text-white",
            icon: Wallet,
          },
          {
            label: "Cash Balance",
            value: formatINR(summaryData?.balancePaise || 0),
            tone: "bg-white text-slate-900 border border-slate-100",
            icon: Briefcase,
          },
          {
            label: "Portfolio P&L",
            value: `${summaryData?.totalPnlPct || 0}%`,
            tone: "bg-white text-slate-900 border border-slate-100",
            icon: Percent,
          },
          {
            label: "Registry State",
            value: summaryState,
            tone: "bg-white text-slate-900 border border-slate-100",
            icon: ListChecks,
          },
        ].map((card) => (
          <div key={card.label} className={`p-10 rounded-[2.5rem] flex flex-col justify-between min-h-[220px] shadow-sm ${card.tone}`}>
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] opacity-60 mb-4 block">{card.label}</span>
            <div>
              <div className="flex items-center justify-between gap-4">
                <h2 className="text-3xl font-black tracking-tighter break-all">{card.value}</h2>
                <card.icon size={22} className="opacity-70 shrink-0" />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
        <div className="lg:col-span-8 space-y-10">
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

            {portfolioState === "PARTIAL" && (
              <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-[10px] font-black uppercase tracking-widest text-amber-700">
                Partial market sync detected. Some prices are fallback values.
              </div>
            )}

            {portfolioState === "COMPLETE" && (
              <div className="mb-6 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-[10px] font-black uppercase tracking-widest text-emerald-700">
                Complete analytics online for all active positions.
              </div>
            )}

            {positions.isLoading ? (
              <div className="space-y-4">
                <div className="h-20 bg-slate-50 rounded-2xl animate-pulse" />
                <div className="h-20 bg-slate-50 rounded-2xl animate-pulse" />
              </div>
            ) : portfolioState === "EMPTY" || positionList.length === 0 ? (
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
                    {positionList.map((pos) => {
                      return (
                        <tr key={pos.symbol} className="group hover:bg-slate-50/50 transition-colors">
                          <td className="py-8 font-black text-slate-900 uppercase tracking-tight">{pos.symbol}</td>
                          <td className="py-8 text-right font-bold text-slate-700">{pos.quantity}</td>
                          <td className="py-8 text-right font-bold text-indigo-600">{formatINR(pos.currentPricePaise)}</td>
                          <td className="py-8 text-right">
                            <span className={`font-black tracking-tighter ${Number(pos.pnlPct || 0) >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                              {Number(pos.pnlPct || 0) >= 0 ? "+" : ""}{Number(pos.pnlPct || 0).toFixed(2)}%
                              <span className="block text-[8px] opacity-70">Server P&L Ratio</span>
                            </span>
                          </td>
                          <td className="py-8 text-center">
                            <button
                              onClick={() => quickSell.open(pos)}
                              className="p-3 bg-rose-50 text-rose-600 rounded-xl hover:bg-rose-600 hover:text-white transition-all shadow-sm"
                            >
                              <SellIcon size={16} />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <AnimatePresence>
            {selectedSellPos && (
              <div className="fixed inset-0 z-50 flex items-center justify-center p-6 sm:p-0">
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  onClick={() => !isProcessingSell && quickSell.close()}
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
                      <button onClick={quickSell.close} className="text-slate-400 hover:text-slate-900">
                        <X size={20} />
                      </button>
                    </div>

                    <div className="space-y-2">
                      <h2 className="text-3xl font-black text-slate-900 tracking-tight">Exit {selectedSellPos.symbol.replace(".NS", "")}</h2>
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
                        onChange={(e) => quickSell.setQuantity(e.target.value)}
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
                        Authorizing this will execute an immediate market-sell. Quick sell — minimal review applied via direct terminal override.
                      </p>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <button
                        onClick={quickSell.close}
                        disabled={isProcessingSell}
                        className="py-4 bg-slate-100 text-slate-900 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-200 transition-all disabled:opacity-50"
                      >
                        Abort
                      </button>
                      <button
                        onClick={quickSell.execute}
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

          <div className="mt-10">
            <PortfolioNews data={portfolioNews.data} isLoading={portfolioNews.isLoading} />
          </div>

          <div className="bg-white rounded-[3rem] border border-slate-100 shadow-sm overflow-hidden">
            <div className="px-12 py-8 bg-slate-50/50 flex items-center justify-between border-b border-slate-100">
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-[0.2em]">Execution Registry</h3>
              <div className="px-3 py-1 bg-white rounded-full border border-slate-200 text-[8px] font-bold text-slate-400 uppercase">Latency-Free Sync</div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <tbody className="divide-y divide-slate-50">
                  {recentTrades.map((trade) => (
                    <tr key={trade.tradeId} className="group hover:bg-slate-50/30 transition-colors">
                      <td className="px-12 py-6">
                        <span className="font-black text-slate-900 text-sm">{trade.symbol.replace(".NS", "")}</span>
                        <span className="block text-[10px] font-bold text-slate-400 tracking-widest">{trade.side}</span>
                      </td>
                      <td className="px-12 py-6 text-right">
                        <span className="font-bold text-slate-900 text-sm">{formatINR((trade.pricePaise || 0) * (trade.quantity || 0))}</span>
                        <span className="block text-[9px] font-medium text-slate-400">{trade.quantity} @ {formatINR(trade.pricePaise)}</span>
                      </td>
                      <td className="px-12 py-6 text-right">
                        <div className="inline-block px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-wider bg-slate-100 text-slate-700">
                          {trade.createdAt ? new Date(trade.createdAt).toLocaleDateString() : "RECENT"}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {recentTrades.length === 0 && (
                    <tr>
                      <td colSpan="3" className="px-12 py-10 text-center text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">
                        No trades in registry.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="lg:col-span-4">
          <div className="bg-slate-50 rounded-[3rem] p-8 border border-slate-100 sticky top-6 shadow-sm">
            <div className="flex items-center justify-between mb-8 px-2">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-white rounded-2xl shadow-sm border border-slate-100">
                  <Activity size={20} className="text-slate-900" />
                </div>
                <h3 className="text-lg font-black tracking-tight text-slate-900">System Snapshot</h3>
              </div>
              <div className="px-3 py-1 bg-white rounded-full border border-slate-100 text-[8px] font-black text-slate-400 uppercase tracking-widest">
                {summaryState}
              </div>
            </div>

            <div className="space-y-4">
              <div className="p-6 bg-white rounded-[2rem] border border-slate-100 shadow-sm">
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block mb-2">Balance</span>
                <p className="text-2xl font-black text-slate-900">{formatINR(summaryData?.balancePaise || 0)}</p>
              </div>
              <div className="p-6 bg-white rounded-[2rem] border border-slate-100 shadow-sm">
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block mb-2">Portfolio Value</span>
                <p className="text-2xl font-black text-slate-900">{formatINR(summaryData?.totalValuePaise || 0)}</p>
              </div>
              <div className="p-6 bg-white rounded-[2rem] border border-slate-100 shadow-sm">
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block mb-2">Open Positions</span>
                <p className="text-2xl font-black text-slate-900">{positionList.length}</p>
              </div>
              <div className="p-6 bg-white rounded-[2rem] border border-slate-100 shadow-sm">
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block mb-2">Recent Trades</span>
                <p className="text-2xl font-black text-slate-900">{recentTrades.length}</p>
              </div>
            </div>

            <div className="pt-8 mt-6 border-t border-slate-200/60">
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
    </MotionDiv>
  );
};

export default Dashboard;
