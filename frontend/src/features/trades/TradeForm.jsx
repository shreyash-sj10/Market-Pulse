import { useState, useEffect, useMemo } from "react";
import { useLocation, useSearchParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { formatINR } from "../../utils/currency.utils";
import toast from "react-hot-toast";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  validateSymbol,
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
  Activity,
  CheckCircle2,
  TrendingDown,
  Target,
  Brain,
  ArrowRight,
  Zap,
  Terminal,
} from "lucide-react";

export default function TradeForm() {
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const querySymbol = (searchParams.get("symbol") || "").toUpperCase();
  const initialSymbol = (location.state?.symbol || querySymbol || "").toUpperCase();
  const tradeType = "BUY";

  // ── STATE: Core Logic ────────────────────────────────────────────────────
  const [symbol, setSymbol] = useState(initialSymbol);
  const [quantity, setQuantity] = useState("1");
  const [priceRupees, setPriceRupees] = useState(""); 
  const [stopLoss, setStopLoss] = useState("");
  const [targetPrice, setTargetPrice] = useState("");
  const [userThinking, setUserThinking] = useState("");
  const [tradeIntent, setTradeIntent] = useState("TREND_FOLLOWING");

  // ── STATE: Intelligence & Flow ───────────────────────────────────────────
  const [step, setStep] = useState(1); 
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

  const summary = summaryResponse?.data;
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

    const risk = entry - sl;
    const reward = target - entry;

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
  }, [priceRupees, stopLoss, targetPrice]);

  const canProceed = symbol && quantity > 0 && priceRupees > 0 && stopLoss > 0 && targetPrice > 0 && rrCalculation?.isValid;

  // ── HANDLERS ──────────────────────────────────────────────────────────────
  const [executionMetadata, setExecutionMetadata] = useState({ token: null, idempotencyKey: null });

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
      setExecutionMetadata(prev => ({ ...prev, token: response.token }));
      setStep(2); // Progress to Phase 2: Intelligence Review
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
    const idempotencyKey = crypto.randomUUID();

    try {
      const res = await executeTrade({
        symbol,
        type: tradeType,
        quantity: parseInt(quantity),
        pricePaise: Math.round(parseFloat(priceRupees) * 100),
        stopLossPaise: Math.round(parseFloat(stopLoss) * 100),
        targetPricePaise: Math.round(parseFloat(targetPrice) * 100),
        userThinking,
        intent: tradeIntent,
        reason: userThinking,
        decisionContext: decisionSnapshot,
        idempotencyKey,
        preTradeToken: executionMetadata.token
      });

      setResult(res.trade);
      setStep(3); // Progress to Phase 3: Success
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
                 { label: "Fill Price", value: formatINR(result.pricePaise) },
                 { label: "Stop Loss", value: formatINR(result.stopLossPaise) },
                 { label: "Target", value: formatINR(result.targetPricePaise) },
                 { label: "Commitment", value: formatINR(result.totalValuePaise) }
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
        
        <div className="p-1 px-4 bg-slate-100 rounded-2xl flex items-center gap-6">
           <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
              <span className="text-[10px] font-black text-slate-900 uppercase tracking-widest">Entry Flow Active</span>
           </div>
           <div className="w-px h-6 bg-slate-200" />
           <div className="flex items-center gap-2 grayscale opacity-40 cursor-not-allowed">
              <TrendingDown size={14} className="text-rose-500" />
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Direct Exit Only (Dashboard)</span>
           </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
        <div className="lg:col-span-8 space-y-12">
          <div className="bg-white rounded-[3.5rem] border border-slate-100 shadow-sm p-12 space-y-12 relative overflow-hidden">
             
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

             <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-6">
                   <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Engagement Controls</label>
                   <div className="space-y-4">
                      <div className="flex bg-slate-50 p-6 rounded-[2rem] border border-slate-100 items-center justify-between">
                         <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Quantity</span>
                         <input 
                           type="number" 
                           value={quantity}
                           onChange={(e) => setQuantity(e.target.value)}
                           className="bg-transparent text-right text-xl font-black text-slate-900 max-w-[120px] outline-none"
                         />
                      </div>
                      <div className="flex bg-slate-50 p-6 rounded-[2rem] border border-slate-100 items-center justify-between">
                         <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Target Entry (₹)</span>
                         <input 
                           type="text"
                           inputMode="decimal"
                           value={priceRupees}
                           onChange={(e) => setPriceRupees(e.target.value)}
                           className="flex-1 bg-transparent text-right text-xl font-black text-slate-900 outline-none"
                         />
                      </div>
                   </div>
                </div>

                <div className="space-y-6">
                   <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Risk Management</label>
                   <div className="space-y-4">
                      <div className="flex bg-rose-50/30 p-6 rounded-[2rem] border border-rose-100 items-center justify-between transition-all hover:bg-rose-50/50">
                         <span className="text-[9px] font-black text-rose-400 uppercase tracking-widest">Stop Loss</span>
                         <input 
                           type="text"
                           inputMode="decimal"
                           value={stopLoss}
                           onChange={(e) => setStopLoss(e.target.value)}
                           className="flex-1 bg-transparent text-right text-xl font-black text-rose-600 outline-none"
                         />
                      </div>
                      <div className="flex bg-emerald-50/30 p-6 rounded-[2rem] border border-emerald-100 items-center justify-between transition-all hover:bg-emerald-50/50">
                         <span className="text-[9px] font-black text-emerald-400 uppercase tracking-widest">Target Price</span>
                         <input 
                           type="text"
                           inputMode="decimal"
                           value={targetPrice}
                           onChange={(e) => setTargetPrice(e.target.value)}
                           className="flex-1 bg-transparent text-right text-xl font-black text-emerald-600 outline-none"
                         />
                      </div>
                   </div>
                </div>
             </div>

             <div className="p-8 bg-slate-900 rounded-[2.5rem] flex flex-col md:flex-row md:items-center justify-between gap-6 shadow-xl shadow-slate-200 overflow-hidden relative">
                <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
                   <Target size={120} className="text-white" />
                </div>
                <div>
                   <span className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] mb-1 block">Capital Commitment</span>
                   <h3 className="text-3xl font-black text-white tracking-tighter">{formatINR((parseFloat(quantity) || 0) * (parseFloat(priceRupees) || 0) * 100)}</h3>
                </div>
                <div className="flex items-center gap-6">
                   <div className="text-right">
                      <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mb-1 block">Risk/Reward Profile</span>
                      <div className="flex items-center gap-3">
                         <span className="text-xl font-black text-white">{rrCalculation?.ratio || "-"}</span>
                         {rrCalculation?.isValid && (
                           <div className={`px-2 py-0.5 rounded text-[8px] font-bold uppercase tracking-widest text-white ${rrCalculation.color}`}>
                              {rrCalculation.status}
                           </div>
                         )}
                      </div>
                   </div>
                   <div className="w-10 h-10 rounded-full border border-slate-700 flex items-center justify-center">
                      <div className={`w-2 h-2 rounded-full ${rrCalculation?.ratio >= 2 ? 'bg-emerald-500 animate-ping' : 'bg-slate-700'}`} />
                   </div>
                </div>
             </div>

             <div className="space-y-6">
                <div className="flex items-center gap-2">
                   <Brain size={14} className="text-indigo-400" />
                   <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Protocol Intent</label>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                   {["TREND_FOLLOWING", "BREAKOUT", "MEAN_REVERSION", "SCALPING"].map(intent => (
                     <button
                        key={intent}
                        onClick={() => setTradeIntent(intent)}
                        className={`py-4 rounded-2xl text-[9px] font-black uppercase tracking-widest transition-all ${tradeIntent === intent ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200' : 'bg-slate-50 text-slate-400 hover:bg-slate-100'}`}
                     >
                        {intent.replace('_', ' ')}
                     </button>
                   ))}
                </div>
             </div>

             <div className="space-y-6">
                <div className="flex items-center gap-2">
                   <Activity size={14} className="text-indigo-400" />
                   <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Decision Rationale</label>
                </div>
                <textarea
                  placeholder="Internal reasoning for institutional audit..."
                  value={userThinking}
                  onChange={(e) => setUserThinking(e.target.value)}
                  className="w-full px-8 py-6 bg-slate-50 border border-slate-100 rounded-[2rem] text-sm font-medium text-slate-900 focus:bg-white focus:border-indigo-600 outline-none transition-all placeholder:text-slate-300 min-h-[140px]"
                />
             </div>

             <button
               onClick={handleReview}
               disabled={!canProceed || isExecuting}
               className={`w-full py-8 rounded-[2rem] text-[11px] font-black uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-3 ${
                 canProceed 
                 ? 'bg-slate-900 text-white hover:bg-indigo-600 shadow-2xl shadow-slate-300' 
                 : 'bg-slate-100 text-slate-300 cursor-not-allowed'
               }`}
             >
               {isValidating ? 'Validating Network...' : 'Initialize CI / Logic Review'}
               <ArrowRight size={16} />
             </button>
          </div>
        </div>

        <div className="lg:col-span-4 space-y-8">
           <ExecutionPersona persona={persona} />
           <SelectionPulse step={step} />
        </div>
      </div>

      <AnimatePresence>
        {showDecisionPanel && (
          <DecisionPanel 
            snapshot={decisionSnapshot} 
            onConfirm={finalizeTrade}
            onClose={() => setShowDecisionPanel(false)}
            isExecuting={isExecuting}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
