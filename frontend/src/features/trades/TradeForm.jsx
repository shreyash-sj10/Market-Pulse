import { useLocation, useSearchParams } from "react-router-dom";
import { AnimatePresence } from "framer-motion";
import { formatINR } from "../../utils/currency.utils";
import SelectionPulse from "./components/SelectionPulse";
import DecisionPanel from "./components/DecisionPanel";
import ExecutionPersona from "./components/ExecutionPersona";
import TradeInsight from "./components/TradeInsight";
import { useTradeFlow } from "../../hooks/useTradeFlow";
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
  const querySymbol = (searchParams.get("symbol") || "").toUpperCase();
  const initialSymbol = (location.state?.symbol || querySymbol || "").toUpperCase();
  const { form, flow, validation, persona, insight } = useTradeFlow({ initialSymbol });
  const {
    symbol,
    quantity,
    priceRupees,
    stopLoss,
    targetPrice,
    userThinking,
    tradeIntent,
    setSymbol,
    setQuantity,
    setPriceRupees,
    setStopLoss,
    setTargetPrice,
    setUserThinking,
    setTradeIntent,
  } = form;
  const {
    step,
    showDecisionPanel,
    decisionSnapshot,
    result,
    isExecuting,
    canProceed,
    capitalCommitmentPaise,
    closeDecisionPanel,
    handleReview,
    finalizeTrade,
    resetTrade,
  } = flow;
  const isValidating = validation.isLoading;
  const personaData = persona.data;


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
            <p className="text-slate-500 font-bold max-w-md mx-auto">Atomic confirmation received. The record is now flowing through the asynchronous intelligence pipeline for behavioral reflection.</p>
            
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              {[
                { label: "Portfolio", status: "✔ updated", color: "text-emerald-600" },
                { label: "Journal", status: "⏳ pending", color: "text-amber-600" },
                { label: "Profile", status: "⏳ updating", color: "text-indigo-600" },
                { label: "Trace", status: "✔ recorded", color: "text-slate-600" }
              ].map(item => (
                <div key={item.label} className="flex items-center gap-1.5 px-4 py-1.5 bg-white border border-slate-100 rounded-full shadow-sm">
                  <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">{item.label}</span>
                  <span className={`text-[8px] font-black ${item.color}`}>{item.status}</span>
                </div>
              ))}
            </div>

            <div className="mt-10 grid grid-cols-2 md:grid-cols-4 gap-4 max-w-2xl mx-auto">
               {[
                 { label: "Fill Price", value: formatINR(result.pricePaise) },
                 { label: "Stop Loss", value: formatINR(result.stopLossPaise) },
                 { label: "Target", value: formatINR(result.targetPricePaise) },
                 { label: "Quantity", value: result.quantity }
               ].map(item => (
                 <div key={item.label} className="p-4 bg-white rounded-2xl border border-slate-100">
                    <span className="block text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">{item.label}</span>
                    <span className="text-sm font-black text-slate-900">{item.value}</span>
                 </div>
               ))}
            </div>

            <button 
              onClick={resetTrade}
              className="mt-12 px-8 py-4 bg-slate-900 text-white rounded-2xl text-[11px] font-black uppercase tracking-widest hover:bg-slate-800 transition-all shadow-xl shadow-slate-200"
            >
              Deploy New Order Plan
            </button>
         </div>
         <TradeInsight trade={result} insight={insight.data} isLoading={insight.isLoading} />
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
                   <h3 className="text-3xl font-black text-white tracking-tighter">{formatINR(capitalCommitmentPaise)}</h3>
                </div>
                <div className="flex items-center gap-6">
                   <div className="text-right">
                      <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mb-1 block">Risk/Reward Profile</span>
                      <div className="flex items-center gap-3">
                         <span className="text-xl font-black text-white">-</span>
                         <div className="px-2 py-0.5 rounded text-[8px] font-bold uppercase tracking-widest text-white bg-slate-700">
                            Server-Validated
                         </div>
                      </div>
                   </div>
                   <div className="w-10 h-10 rounded-full border border-slate-700 flex items-center justify-center">
                      <div className="w-2 h-2 rounded-full bg-slate-500" />
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
           <ExecutionPersona persona={personaData} />
           <SelectionPulse step={step} />
        </div>
      </div>

      <AnimatePresence>
        {showDecisionPanel && (
          <DecisionPanel 
            snapshot={decisionSnapshot} 
            onConfirm={finalizeTrade}
            onClose={closeDecisionPanel}
            isExecuting={isExecuting}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
