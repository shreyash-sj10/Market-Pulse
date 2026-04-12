import { useState, useEffect, useMemo } from "react";
import { useLocation, useSearchParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { formatINR } from "../../utils/currency.utils";
import toast from "react-hot-toast";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  validateSymbol,
  getStockPrice,
  getLivePrice,
} from "../../services/market.api";
import { executeTrade } from "../../services/trade.api";
import { getPositions, getPortfolioSummary } from "../../services/portfolio.api";
import { getPreTradeGuard, getAdaptiveProfile } from "../../services/intelligence.api";
import SelectionPulse from "./components/SelectionPulse";
import DecisionPanel from "./components/DecisionPanel";
import ExecutionPersona from "./components/ExecutionPersona";
import TradeInsight from "./components/TradeInsight";
import PriceChart from "./components/PriceChart";
import {
  Search,
  Zap,
  ShieldAlert,
  Activity,
  ArrowRight,
  Brain,
  Sparkles,
  CheckCircle2,
  TrendingUp,
  Target,
  Terminal,
} from "lucide-react";

export default function TradeForm() {
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const querySymbol = (searchParams.get("symbol") || "").toUpperCase();
  const querySide = (searchParams.get("side") || "").toUpperCase();
  const initialSymbol = (location.state?.symbol || querySymbol || "").toUpperCase();
  const initialType = location.state?.type || (querySide === "SELL" ? "SELL" : "BUY");

  // ── STATE: Core Logic ────────────────────────────────────────────────────
  const [symbol, setSymbol] = useState(initialSymbol);
  const [quantity, setQuantity] = useState("1");
  const [priceRupees, setPriceRupees] = useState(""); 
  const [stopLoss, setStopLoss] = useState("");
  const [targetPrice, setTargetPrice] = useState("");
  const [tradeType, setTradeType] = useState(initialType);
  const [userThinking, setUserThinking] = useState("");
  const [tradeIntent, setTradeIntent] = useState("TREND_FOLLOWING");
  const [manualTags, setManualTags] = useState("");

  // ── STATE: Intelligence & Flow ───────────────────────────────────────────
  const [step, setStep] = useState(1); // 1: Select, 2: Execute success?
  const [isExecuting, setIsExecuting] = useState(false);
  const [showDecisionPanel, setShowDecisionPanel] = useState(false);
  const [decisionSnapshot, setDecisionSnapshot] = useState(null);
  const [result, setResult] = useState(null);

  // ── QUERIES ──────────────────────────────────────────────────────────────
  const { data: validation, isLoading: isValidating } = useQuery({
    queryKey: ["validate", symbol],
    queryFn: () => validateSymbol(symbol),
    enabled: symbol.length >= 2,
    staleTime: 60000,
  });

  const { data: posResponse } = useQuery({
    queryKey: ["positions"],
    queryFn: getPositions,
  });

  const { data: summaryResponse } = useQuery({
    queryKey: ["portfolio"],
    queryFn: getPortfolioSummary,
  });

  const { data: persona } = useQuery({
    queryKey: ["adaptive-profile"],
    queryFn: getAdaptiveProfile,
  });

  const balance = summaryResponse?.summary?.balance || 0;

  const positions = posResponse?.positions || [];

  // Auto-fill price on symbol validation
  useEffect(() => {
    if (validation?.isValid && validation.data?.price && !priceRupees) {
      setPriceRupees((validation.data.price / 100).toString());
    }
  }, [validation]);

  // ── CALCULATIONS ─────────────────────────────────────────────────────────
  const rrCalculation = useMemo(() => {
    const entry = parseFloat(priceRupees);
    const sl = parseFloat(stopLoss);
    const target = parseFloat(targetPrice);

    if (!entry || !sl || !target) return null;

    const risk = tradeType === "BUY" ? entry - sl : sl - entry;
    const reward = tradeType === "BUY" ? target - entry : entry - target;

    if (risk <= 0 || reward <= 0) return { isValid: false, ratio: 0, reason: "Math violation" };

    const ratio = Number((reward / risk).toFixed(2));
    let color = "bg-rose-500";
    if (ratio >= 3) color = "bg-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.4)]";
    else if (ratio >= 2) color = "bg-indigo-500 shadow-[0_0_15px_rgba(99,102,241,0.4)]";
    else if (ratio >= 1.5) color = "bg-amber-500";

    return {
      isValid: true,
      ratio,
      color,
      status: ratio >= 3 ? "Institutional" : ratio >= 2 ? "Optimal" : ratio >= 1.5 ? "Acceptable" : "Sub-optimal"
    };
  }, [priceRupees, stopLoss, targetPrice, tradeType]);

  const canProceed = symbol && quantity > 0 && priceRupees > 0 && stopLoss > 0 && targetPrice > 0 && rrCalculation?.isValid;

  // ── HANDLERS ──────────────────────────────────────────────────────────────
  const handleReview = async () => {
    if (!canProceed) return toast.error("Deployment plan incomplete. Enforce Risk/Reward integrity.");

    const toastId = toast.loading("Synthesizing Institutional Decision Layers...");
    try {
      const response = await getPreTradeGuard({
        symbol,
        quantity: parseInt(quantity),
        price: parseFloat(priceRupees) * 100,
        stopLoss: parseFloat(stopLoss) * 100,
        targetPrice: parseFloat(targetPrice) * 100,
        side: tradeType,
        userThinking
      });
      setDecisionSnapshot(response.snapshot);
      setShowDecisionPanel(true);
      toast.dismiss(toastId);
    } catch (err) {
      toast.error("Decision engine timeout. Check local synchronization.");
      toast.dismiss(toastId);
    }
  };

  const finalizeTrade = async () => {
    setIsExecuting(true);
    setShowDecisionPanel(false);
    const toastId = toast.loading("Executing Atomic Protocol...");

    try {
      const res = await executeTrade({
        symbol,
        type: tradeType,
        quantity: parseInt(quantity),
        price: Math.round(parseFloat(priceRupees) * 100),
        stopLoss: Math.round(parseFloat(stopLoss) * 100),
        targetPrice: Math.round(parseFloat(targetPrice) * 100),
        userThinking,
        intent: tradeIntent,
        manualTags: manualTags.split(",").map(t => t.trim()).filter(t => t),
        rrRatio: rrCalculation?.ratio,
        intelligenceTimeline: decisionSnapshot,
        decisionAuthorized: decisionSnapshot.verdict
      });

      setResult(res.trade);
      setStep(3); // Show Success State
      toast.success("Trade Plan Authorized and Executed.", { id: toastId });
      queryClient.invalidateQueries(["portfolio"]);
      queryClient.invalidateQueries(["positions"]);
    } catch (err) {
      toast.error(err.response?.data?.message || "Execution Engine Error", { id: toastId });
    } finally {
      setIsExecuting(false);
    }
  };

  if (step === 3 && result) {
    return (
      <div className="p-8 max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
         <div className="bg-emerald-50 border border-emerald-100 rounded-[3rem] p-12 text-center relative overflow-hidden">
            <div className="absolute top-0 right-0 p-8 opacity-5">
               <CheckCircle2 size={160} />
            </div>
            <div className="w-20 h-20 bg-emerald-500 rounded-full flex items-center justify-center mx-auto mb-6 shadow-xl shadow-emerald-200">
               <CheckCircle2 size={40} className="text-white" />
            </div>
            <h2 className="text-4xl font-black text-slate-900 tracking-tight mb-4">Trade Plan Executed.</h2>
            <p className="text-slate-500 font-bold max-w-md mx-auto">Atomic confirmation received. The holding has been synchronized with your master ledger and a Decision Snapshot has been archived.</p>
            
            <div className="mt-12 grid grid-cols-2 md:grid-cols-4 gap-4 max-w-2xl mx-auto">
               {[
                 { label: "Fill Price", value: formatINR(result.price) },
                 { label: "Stop Loss", value: formatINR(result.stopLoss) },
                 { label: "Target", value: formatINR(result.targetPrice) },
                 { label: "Commitment", value: formatINR(result.totalValue) }
               ].map(item => (
                 <div key={item.label} className="p-4 bg-white rounded-2xl border border-slate-100">
                    <span className="block text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">{item.label}</span>
                    <span className="text-sm font-black text-slate-900">{item.value}</span>
                 </div>
               ))}
            </div>

            <button 
              onClick={() => { setStep(1); setSymbol(""); setPriceRupees(""); setStopLoss(""); setTargetPrice(""); setResult(null); }}
              className="mt-12 px-8 py-4 bg-slate-900 text-white rounded-2xl text-[11px] font-black uppercase tracking-widest hover:bg-slate-800 transition-all shadow-xl shadow-slate-200"
            >
              Deploy New Order Plan
            </button>
         </div>
         <TradeInsight symbol={symbol} trade={result} />
      </div>
    );
  }

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-12 pb-40">
      {/* 🟢 HEADER */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-8 mb-12">
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.4em]">Node: Terminal Execution</span>
          </div>
          <h1 className="text-5xl font-black text-slate-900 tracking-tighter">
            Trade <span className="text-slate-400">Terminal</span>
          </h1>
        </div>
        
        <div className="flex p-1.5 bg-slate-100 rounded-2xl">
          {["BUY", "SELL"].map(type => (
            <button
              key={type}
              onClick={() => setTradeType(type)}
              className={`px-8 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${tradeType === type ? "bg-white text-slate-900 shadow-sm" : "text-slate-400 hover:text-slate-600"}`}
            >
              {type}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
        {/* ── LEFT: INPUT HUB ── */}
        <div className="lg:col-span-8 space-y-12">
          <div className="bg-white rounded-[3.5rem] border border-slate-100 shadow-sm p-12 space-y-12 relative overflow-hidden">
             
             {/* 1. SYMBOL SELECTION */}
             <div className="space-y-6">
                <div className="flex items-center justify-between">
                   <div className="flex items-center gap-2">
                      <Search size={14} className="text-indigo-400" />
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Asset Identification</label>
                   </div>
                   {isValidating && <Activity size={12} className="text-indigo-500 animate-spin" />}
                </div>
                <div className="relative group">
                   <input
                     type="text"
                     placeholder="SYMBOL (e.g. HDFCBANK.NS)"
                     value={symbol}
                     onChange={(e) => setSymbol(e.target.value.toUpperCase())}
                     className="w-full px-8 py-6 bg-slate-50 border border-slate-100 rounded-[2rem] text-xl font-black text-slate-900 focus:bg-white focus:border-indigo-600 outline-none transition-all placeholder:text-slate-300"
                   />
                </div>
             </div>

             {/* 2. PARAMETER MATRIX */}
             <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-6">
                   <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Engagement Controls</label>
                   <div className="space-y-4">
                      <div className="relative">
                         <input
                           type="number"
                           placeholder="Quantity"
                           value={quantity}
                           onChange={(e) => setQuantity(e.target.value)}
                           className="w-full px-8 py-5 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-black text-slate-900 focus:bg-white focus:border-indigo-600 outline-none transition-all"
                         />
                      </div>
                      <div className="relative">
                         <input
                           type="number"
                           placeholder="Price (INR)"
                           value={priceRupees}
                           onChange={(e) => setPriceRupees(e.target.value)}
                           className="w-full px-8 py-5 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-black text-slate-900 focus:bg-white focus:border-indigo-600 outline-none transition-all"
                         />
                      </div>
                   </div>
                </div>

                <div className="space-y-6">
                   <div className="flex items-center justify-between px-1">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Risk Management</label>
                      <div className="flex gap-2">
                         {[1, 2, 5].map(pct => (
                            <button
                               key={pct}
                               onClick={() => {
                                  const riskAmt = balance * (pct / 100);
                                  const qty = parseInt(quantity) || 1;
                                  const entry = parseFloat(priceRupees) || 0;
                                  if (entry > 0) {
                                     const sl = tradeType === 'BUY' ? entry - (riskAmt / qty) : entry + (riskAmt / qty);
                                     setStopLoss(Math.max(0, Number(sl.toFixed(2))).toString());
                                  }
                               }}
                               className="px-2 py-1 bg-slate-100 hover:bg-indigo-600 hover:text-white rounded-md text-[8px] font-black transition-all"
                            >
                               {pct}% RISK
                            </button>
                         ))}
                      </div>
                   </div>
                   <div className="space-y-4">
                      <div className="relative group">
                         <input
                           type="number"
                           placeholder="Stop Loss (INR)"
                           value={stopLoss}
                           onChange={(e) => setStopLoss(e.target.value)}
                           className="w-full px-8 py-5 bg-rose-50/50 border border-rose-100 rounded-2xl text-sm font-black text-slate-900 focus:bg-white focus:border-rose-600 outline-none transition-all"
                         />
                         <ShieldAlert size={14} className="absolute right-6 top-1/2 -translate-y-1/2 text-rose-300 group-focus-within:text-rose-600 transition-colors" />
                      </div>
                      <div className="relative group">
                         <input
                           type="number"
                           placeholder="Target Price (INR)"
                           value={targetPrice}
                           onChange={(e) => setTargetPrice(e.target.value)}
                           className="w-full px-8 py-5 bg-emerald-50/50 border border-emerald-100 rounded-2xl text-sm font-black text-slate-900 focus:bg-white focus:border-emerald-600 outline-none transition-all"
                         />
                         <TrendingUp size={14} className="absolute right-6 top-1/2 -translate-y-1/2 text-emerald-300 group-focus-within:text-emerald-600 transition-colors" />
                      </div>
                   </div>
                </div>
             </div>

             {/* 3. VALUE & RR PREVIEW */}
             <div className="p-8 bg-slate-900 rounded-[2.5rem] flex flex-col md:flex-row items-center justify-between text-white relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:scale-110 transition-transform duration-700">
                   <Target size={120} />
                </div>
                <div className="relative z-10 flex-1 w-full md:border-r md:border-white/10 md:pr-10 mb-6 md:mb-0">
                   <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest block mb-1">Capital Commitment</span>
                   <h3 className="text-3xl font-black tracking-tighter">
                      {formatINR(Math.round(parseFloat(quantity || 0) * parseFloat(priceRupees || 0) * 100))}
                   </h3>
                </div>
                <div className="relative z-10 flex-1 w-full md:pl-10 space-y-4">
                   <div className="flex justify-between items-end">
                      <div>
                         <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest block mb-1">Risk/Reward Profile</span>
                         <span className="text-2xl font-black tracking-tighter">{rrCalculation?.ratio || '0.00'}</span>
                      </div>
                      {rrCalculation && (
                         <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest ${rrCalculation.color.replace('bg-', 'text-').replace(' shadow-', '')}`}>
                            {rrCalculation.status}
                         </span>
                      )}
                   </div>
                   {/* Dynamic RR Meter */}
                   <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden flex">
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: `${Math.min(100, (rrCalculation?.ratio || 0) * 20)}%` }}
                        className={`h-full transition-all duration-500 ${rrCalculation?.color || 'bg-slate-700'}`}
                      />
                   </div>
                </div>
             </div>

             {/* 4. STRATEGIC INTENT & TAGS */}
             <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-4">
                   <div className="flex items-center gap-2">
                      <Target size={14} className="text-indigo-400" />
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Protocol Intent</label>
                   </div>
                   <select 
                     value={tradeIntent}
                     onChange={(e) => setTradeIntent(e.target.value)}
                     className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-xs font-black text-slate-900 focus:bg-white focus:border-indigo-600 outline-none transition-all uppercase appearance-none cursor-pointer"
                   >
                      <option value="TREND_FOLLOWING">Trend Following</option>
                      <option value="MEAN_REVERSION">Mean Reversion</option>
                      <option value="BREAKOUT">Institutional Breakout</option>
                      <option value="SCALPING">High-Latency Scalp</option>
                      <option value="HEDGE">Non-Directional Hedge</option>
                   </select>
                </div>
                <div className="space-y-4">
                   <div className="flex items-center gap-2">
                       <Activity size={14} className="text-indigo-400" />
                       <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Manual Meta Tags</label>
                   </div>
                   <input
                     type="text"
                     placeholder="e.g. FOMO, VOLUME_GAP, MORNING_RUSH"
                     value={manualTags}
                     onChange={(e) => setManualTags(e.target.value)}
                     className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-xs font-bold text-slate-900 focus:bg-white focus:border-indigo-600 outline-none transition-all"
                   />
                </div>
             </div>

             {/* 5. INTENT CAPTURE */}
             <div className="space-y-4">
                <div className="flex items-center gap-2">
                   <Brain size={14} className="text-indigo-400" />
                   <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Decision Rationale</label>
                </div>
                <textarea
                  value={userThinking}
                  onChange={(e) => setUserThinking(e.target.value)}
                  placeholder="Describe your reasoning. Our AI cross-references this with sector consensus."
                  className="w-full px-8 py-6 bg-slate-50 border border-slate-100 rounded-[2rem] text-sm font-bold text-slate-900 focus:bg-white focus:border-indigo-600 outline-none transition-all min-h-[120px] resize-none leading-relaxed"
                />
             </div>

             <button
               disabled={!canProceed}
               onClick={handleReview}
               className={`w-full py-6 rounded-2xl font-black text-[11px] uppercase tracking-[0.25em] flex items-center justify-center gap-3 transition-all ${canProceed ? "bg-slate-900 text-white hover:bg-black shadow-xl shadow-slate-900/40" : "bg-slate-100 text-slate-400 cursor-not-allowed"}`}
             >
               Initialize CI / Logic Review <ArrowRight size={18} />
             </button>
          </div>

          {symbol && validation?.isValid && (
            <div className="bg-white rounded-[3.5rem] border border-slate-100 shadow-sm overflow-hidden h-[600px]">
              <PriceChart symbol={symbol} />
            </div>
          )}
        </div>

        {/* ── RIGHT: INTELLIGENCE ── */}
        <div className="lg:col-span-4 space-y-8">
           <ExecutionPersona persona={persona} />
           
           <div className="bg-slate-900 rounded-[3rem] p-10 text-white relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:scale-105 transition-transform duration-700">
                 <Terminal size={140} />
              </div>
              <div className="relative z-10 space-y-8">
                 <div>
                    <span className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.3em] mb-4 block">Adaptive IQ Pipeline</span>
                    <h3 className="text-3xl font-black tracking-tighter">Terminal <br/><span className="text-slate-500">Telemetry</span></h3>
                 </div>
                 <p className="text-sm font-medium text-slate-400 leading-relaxed italic">
                    "Every execution node is archived. Our decision engine observes plan-adherence to adapt your future risk guardrails."
                 </p>
                 <div className="space-y-4 pt-6 border-t border-white/5">
                    <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest">
                       <span className="text-slate-500">Latency Core</span>
                       <span className="text-emerald-400">Stable (12ms)</span>
                    </div>
                    <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest">
                       <span className="text-slate-500">Protocol Sync</span>
                       <span className="text-indigo-400">100% Active</span>
                    </div>
                 </div>
              </div>
           </div>
        </div>
      </div>

      <DecisionPanel
        isOpen={showDecisionPanel}
        onClose={() => setShowDecisionPanel(false)}
        onConfirm={finalizeTrade}
        snapshot={decisionSnapshot}
        tradeRequest={{
          symbol,
          side: tradeType,
          quantity,
          price: priceRupees,
          stopLoss,
          targetPrice,
          userThinking
        }}
      />
    </div>
  );
}
