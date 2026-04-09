import { useState, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import toast from "react-hot-toast";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Zap,
  Tag,
  ShieldCheck,
  Brain,
  TrendingUp,
  TrendingDown,
  CheckCircle,
  Info,
  Activity,
  ArrowRight
} from "lucide-react";
import { buyTrade, sellTrade } from "../../services/trade.api.js";
import { getStockPrice, validateSymbol } from "../../services/market.api.js";
import { getPositions } from "../../services/portfolio.api.js";
import { formatINR } from "../../utils/currency.utils";
import PriceChart from "./components/PriceChart.jsx";

const TradeForm = () => {
  const location = useLocation();
  const queryClient = useQueryClient();

  // Form State
  const [symbol, setSymbol] = useState(location.state?.symbol || "");
  const [quantity, setQuantity] = useState("");
  const [price, setPrice] = useState("");
  const [stopLoss, setStopLoss] = useState("");
  const [targetPrice, setTargetPrice] = useState("");
  const [reason, setReason] = useState("");
  const [userThinking, setUserThinking] = useState("");
  const [tradeType, setTradeType] = useState(location.state?.type || "BUY");

  // UI State
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);
  const [fetchingPrice, setFetchingPrice] = useState(false);
  const [isValidSymbol, setIsValidSymbol] = useState(null); // null, true, false
  const [activeStep, setActiveStep] = useState(1);
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  // Positions Data
  const { data: posResponse, isLoading: posLoading } = useQuery({
    queryKey: ["positions"],
    queryFn: getPositions,
    refetchInterval: 30000
  });
  const positions = posResponse?.positions || [];

  // Price synchronization + Validation
  useEffect(() => {
    if (!symbol) {
      setIsValidSymbol(null);
      return;
    }
    const timeout = setTimeout(async () => {
      try {
        setFetchingPrice(true);
        const validation = await validateSymbol(symbol.toUpperCase());
        setIsValidSymbol(validation.isValid);
        
        if (validation.isValid && validation.data) {
          setPrice(validation.data.price.toString());
        }
      } catch (err) {
        console.warn("Validation service unavailable");
      } finally {
        setFetchingPrice(false);
      }
    }, 800);
    return () => clearTimeout(timeout);
  }, [symbol]);

  const handleSellInitiate = (pos) => {
    setTradeType("SELL");
    setSymbol(pos.fullSymbol || pos.symbol);
    setQuantity(pos.quantity.toString());
    setPrice(pos.currentPrice.toString());
    setActiveStep(1); // Reset to first step to review
    toast.success(`Configured exit for ${pos.symbol}`);
  };

  const handleSubmit = async () => {
    if (loading) return;
    setLoading(true);
    setError("");
    setShowConfirmModal(false);

    const loadingToast = toast.loading("Broadcasting order to terminal...");

    try {
      const payload = {
        symbol: symbol.toUpperCase(),
        quantity: parseInt(quantity, 10),
        price: parseFloat(price),
        stopLoss: stopLoss ? parseFloat(stopLoss) : null,
        targetPrice: targetPrice ? parseFloat(targetPrice) : null,
        reason,
        userThinking
      };

      const data = tradeType === "BUY" ? await buyTrade(payload) : await sellTrade(payload);
      setResult(data.trade);

      // Reset form
      setQuantity("");
      setStopLoss("");
      setTargetPrice("");
      setReason("");
      setUserThinking("");
      
      queryClient.invalidateQueries({ queryKey: ["portfolio"] });
      queryClient.invalidateQueries({ queryKey: ["trades"] });
      queryClient.invalidateQueries({ queryKey: ["positions"] });

      toast.success(`${tradeType} order committed successfully.`, { id: loadingToast });
    } catch (err) {
      const message = err.response?.data?.message || err.message || "Comm engine failure";
      setError(message);
      toast.error(message, { id: loadingToast });
    } finally {
      setLoading(false);
    }
  };

  const steps = [
    { id: 1, title: "Position", icon: <Tag size={16} /> },
    { id: 2, title: "Risk", icon: <ShieldCheck size={16} /> },
    { id: 3, title: "Ritual", icon: <Brain size={16} /> }
  ];

  return (
    <div className="max-w-[1400px] mx-auto pb-20 px-4 mt-6">
      <div className="flex flex-col lg:flex-row gap-10">
        
        {/* Main Terminal Column */}
        <div className="flex-1 lg:max-w-[850px] space-y-10">
          
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
             <div className="px-8 py-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/30">
                <div className="flex items-center gap-3">
                   <div className="p-2.5 bg-slate-900 rounded-xl text-white">
                      <Zap size={20} />
                   </div>
                   <h2 className="text-xl font-bold text-slate-900 tracking-tight">Order Execution Terminal</h2>
                </div>
                <div className="flex gap-2">
                    {steps.map(s => (
                        <div key={s.id} className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-all ${activeStep === s.id ? 'bg-indigo-600 text-white border-indigo-600 shadow-lg shadow-indigo-600/20' : 'bg-white text-slate-400 border-slate-200'}`}>
                            {s.icon}
                            <span className="text-[10px] font-bold uppercase tracking-widest">{s.title}</span>
                        </div>
                    ))}
                </div>
             </div>

             <div className="p-10">
                <AnimatePresence mode="wait">
                    {activeStep === 1 && (
                        <motion.div
                            key="step1"
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: 10 }}
                            className="space-y-8"
                        >
                            <div className="flex p-1.5 bg-slate-100 rounded-xl border border-slate-200">
                                <button
                                    onClick={() => setTradeType("BUY")}
                                    className={`flex-1 flex items-center justify-center gap-2 py-4 rounded-lg text-[11px] font-bold uppercase tracking-widest transition-all ${tradeType === 'BUY' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                                >
                                    <TrendingUp size={16} /> Build Long
                                </button>
                                <button
                                    onClick={() => setTradeType("SELL")}
                                    className={`flex-1 flex items-center justify-center gap-2 py-4 rounded-lg text-[11px] font-bold uppercase tracking-widest transition-all ${tradeType === 'SELL' ? 'bg-white text-rose-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                                >
                                    <TrendingDown size={16} /> Exit Position
                                </button>
                            </div>

                            <div className="space-y-6">
                                <div>
                                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3 ml-1">Asset Identifier (Ticker)</label>
                                    <div className="relative">
                                        <input
                                            type="text"
                                            value={symbol}
                                            autoFocus
                                            autoComplete="off"
                                            onChange={(e) => setSymbol(e.target.value.toUpperCase().trim())}
                                            placeholder="TICKER (e.g. RELIANCE)"
                                            className={`w-full bg-slate-50 border-2 focus:bg-white rounded-xl px-6 py-5 font-black text-slate-900 placeholder:text-slate-300 outline-none transition-all uppercase tracking-wider relative z-20 ${isValidSymbol === true ? 'border-emerald-500' : isValidSymbol === false ? 'border-rose-500' : 'border-slate-200 focus:border-indigo-600'}`}
                                        />
                                        {fetchingPrice && (
                                            <div className="absolute right-6 top-1/2 -translate-y-1/2 z-30">
                                                <Activity size={18} className="text-indigo-600 animate-spin" />
                                            </div>
                                        )}
                                        {isValidSymbol === false && (
                                            <p className="mt-2 text-[10px] font-bold text-rose-500 uppercase tracking-widest pl-1">Unrecognized Ticker—Capital Allocation Blocked</p>
                                        )}
                                    </div>
                                </div>
                                <div className="h-[300px] rounded-xl overflow-hidden border border-slate-100 bg-slate-50 relative">
                                    <PriceChart symbol={symbol} />
                                    {!symbol && (
                                        <div className="absolute inset-0 bg-slate-50/80 backdrop-blur-[1px] flex items-center justify-center z-10">
                                            <div className="text-center">
                                                <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-3">
                                                    <Zap size={20} className="text-slate-300" />
                                                </div>
                                                <span className="text-slate-400 text-[10px] font-bold uppercase tracking-[0.2em]">Awaiting Ticker Identification</span>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                            
                            <button 
                                disabled={!symbol || isValidSymbol !== true || fetchingPrice}
                                onClick={() => setActiveStep(2)}
                                className="w-full py-5 bg-slate-900 hover:bg-black text-white rounded-xl font-bold text-[10px] uppercase tracking-[0.2em] transition-all disabled:opacity-50"
                            >
                                Advance to Risk Management
                            </button>
                        </motion.div>
                    )}

                    {activeStep === 2 && (
                        <motion.div
                            key="step2"
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: 10 }}
                            className="space-y-8"
                        >
                            <div className="grid grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3 ml-1">Volume Quantity</label>
                                    <input
                                        type="number"
                                        value={quantity}
                                        onChange={(e) => setQuantity(e.target.value)}
                                        placeholder="0"
                                        className="w-full bg-slate-50 border border-slate-200 focus:border-indigo-600 rounded-xl px-6 py-4 font-bold text-slate-900 placeholder:text-slate-300 outline-none transition-all"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3 ml-1">Limit Price (INR)</label>
                                    <input
                                        type="number"
                                        value={price}
                                        onChange={(e) => setPrice(e.target.value)}
                                        placeholder="0.00"
                                        className="w-full bg-slate-50 border border-slate-200 focus:border-indigo-600 rounded-xl px-6 py-4 font-bold text-slate-900 placeholder:text-slate-300 outline-none transition-all"
                                    />
                                </div>
                            </div>

                            <div className="p-8 bg-slate-50 border border-slate-200 rounded-2xl relative overflow-hidden">
                                <div className="absolute top-0 left-0 w-1 h-full bg-rose-500" />
                                <div className="flex items-center gap-2 mb-6">
                                    <ShieldCheck size={18} className="text-slate-900" />
                                    <span className="text-[10px] font-bold uppercase tracking-widest text-slate-900">Capital Protection System</span>
                                </div>
                                <div className="grid grid-cols-2 gap-6 relative z-10">
                                    <div>
                                        <label className="block text-[9px] font-bold text-rose-500 uppercase tracking-widest mb-2 ml-1">Stop Loss (Hard-Exit)</label>
                                        <input
                                            type="number"
                                            value={stopLoss}
                                            onChange={(e) => setStopLoss(e.target.value)}
                                            placeholder="Exit if price hits..."
                                            className="w-full bg-white border border-slate-200 focus:border-rose-500 rounded-xl px-5 py-3.5 text-sm font-bold text-slate-900 outline-none transition-all placeholder:text-slate-200"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[9px] font-bold text-emerald-500 uppercase tracking-widest mb-2 ml-1">Take Profit (Target)</label>
                                        <input
                                            type="number"
                                            value={targetPrice}
                                            onChange={(e) => setTargetPrice(e.target.value)}
                                            placeholder="Exit if goal hits..."
                                            className="w-full bg-white border border-slate-200 focus:border-emerald-500 rounded-xl px-5 py-3.5 text-sm font-bold text-slate-900 outline-none transition-all placeholder:text-slate-200"
                                        />
                                    </div>
                                </div>
                                <p className="mt-5 text-[9px] font-medium text-slate-400 italic">
                                    * The backend Algorithmic Guardian will monitor these thresholds every 2 minutes and execute an exit order automatically to protect your equity.
                                </p>
                            </div>

                            <div className="flex gap-4">
                                <button 
                                    onClick={() => setActiveStep(1)}
                                    className="flex-1 py-5 bg-white border border-slate-200 text-slate-900 rounded-xl font-bold text-[10px] uppercase tracking-widest hover:bg-slate-50 transition-all"
                                >
                                    Return to Selection
                                </button>
                                <button 
                                    disabled={!quantity || !price}
                                    onClick={() => setActiveStep(3)}
                                    className="flex-[2] py-5 bg-slate-900 hover:bg-black text-white rounded-xl font-bold text-[10px] uppercase tracking-[0.2em] transition-all disabled:opacity-50"
                                >
                                    Proceed to Ritual
                                </button>
                            </div>
                        </motion.div>
                    )}

                    {activeStep === 3 && (
                        <motion.div
                            key="step3"
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: 10 }}
                            className="space-y-8"
                        >
                            <div className="space-y-8">
                                <div>
                                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3 ml-1">Logical Rationale</label>
                                    <textarea
                                        value={reason}
                                        onChange={(e) => setReason(e.target.value)}
                                        placeholder="Describe the trade setup (e.g., Retesting weekly support level, MACD crossover...)"
                                        className="w-full bg-slate-50 border border-slate-200 focus:border-indigo-600 rounded-xl px-6 py-4 font-semibold text-slate-900 placeholder:text-slate-300 outline-none transition-all h-[120px] resize-none"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3 ml-1">Psychological Internal Monologue</label>
                                    <textarea
                                        value={userThinking}
                                        onChange={(e) => setUserThinking(e.target.value)}
                                        placeholder="Be honest—what are you feeling? (e.g., FOMO, calm confidence, desperate to recover losses...)"
                                        className="w-full bg-slate-50 border border-slate-200 focus:border-indigo-600 rounded-xl px-6 py-4 font-semibold text-slate-900 placeholder:text-slate-300 outline-none transition-all h-[120px] resize-none"
                                    />
                                </div>
                            </div>

                            <div className="pt-4 space-y-4">
                                <button 
                                    disabled={loading}
                                    onClick={() => setShowConfirmModal(true)}
                                    className={`w-full py-6 rounded-xl text-white font-bold text-xs uppercase tracking-[0.25em] shadow-lg transition-all transform active:scale-95 ${tradeType === 'BUY' ? 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-500/20' : 'bg-rose-600 hover:bg-rose-700 shadow-rose-500/20'}`}
                                >
                                    {loading ? 'Finalising Protocols...' : `Review ${tradeType} Execution Plan`}
                                </button>
                                <button 
                                    onClick={() => setActiveStep(2)}
                                    className="w-full py-4 text-slate-400 hover:text-slate-600 font-bold text-[9px] uppercase tracking-widest transition-all"
                                >
                                    Review Risk Parameters
                                </button>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
             </div>
          </div>

          {/* POSITIONS PANEL */}
          <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
              <div className="px-8 py-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                  <h3 className="text-xs font-bold text-slate-900 uppercase tracking-[0.2em] flex items-center gap-2">
                     <Activity size={16} className="text-indigo-600" />
                     Your Live Positions
                  </h3>
                  <div className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">MTM Live</span>
                  </div>
              </div>

              {posLoading ? (
                  <div className="p-10 space-y-4">
                      {[1, 2].map(i => <div key={i} className="h-20 bg-slate-50 rounded-2xl animate-pulse" />)}
                  </div>
              ) : positions.length === 0 ? (
                  <div className="p-16 text-center">
                      <p className="text-sm font-bold text-slate-400 italic">You don't have any open positions in the current cycle.</p>
                  </div>
              ) : (
                  <div className="overflow-x-auto">
                      <table className="w-full text-left">
                          <thead className="bg-slate-50/50 text-[9px] font-bold text-slate-400 uppercase tracking-widest border-b border-slate-100">
                              <tr>
                                  <th className="px-8 py-4">Asset</th>
                                  <th className="px-8 py-4 text-right">Qty</th>
                                  <th className="px-8 py-4 text-right">Avg Price</th>
                                  <th className="px-8 py-4 text-right">LTP</th>
                                  <th className="px-8 py-4 text-right">Unrealized P&L</th>
                                  <th className="px-8 py-4 text-center">Action</th>
                              </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-50">
                              {positions.map((pos) => (
                                  <tr key={pos.symbol} className="group hover:bg-slate-50/30 transition-colors">
                                      <td className="px-8 py-5">
                                          <span className="font-black text-slate-900 text-sm tracking-tight">{pos.symbol}</span>
                                      </td>
                                      <td className="px-8 py-5 text-right font-bold text-slate-700 text-sm">{pos.quantity}</td>
                                      <td className="px-8 py-5 text-right text-slate-500 text-[11px] font-bold">{formatINR(pos.avgPrice)}</td>
                                      <td className="px-8 py-5 text-right text-indigo-600 font-black text-sm">{formatINR(pos.currentPrice)}</td>
                                      <td className="px-8 py-5 text-right">
                                          <span className={`font-black text-sm tracking-tighter ${pos.unrealizedPnL >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                                              {pos.unrealizedPnL >= 0 ? "+" : ""}{formatINR(pos.unrealizedPnL)}
                                              <span className="block text-[8px] opacity-70">({pos.pnlPercentage}%)</span>
                                          </span>
                                      </td>
                                      <td className="px-8 py-5 text-center">
                                          <button 
                                              onClick={() => handleSellInitiate(pos)}
                                              className="p-2.5 bg-rose-50 text-rose-600 hover:bg-rose-600 hover:text-white rounded-xl transition-all"
                                              title="Quick Exit"
                                          >
                                              <TrendingDown size={16} />
                                          </button>
                                      </td>
                                  </tr>
                              ))}
                          </tbody>
                      </table>
                  </div>
              )}
          </div>
        </div>

        {/* Intelligence Sidebar */}
        <div className="lg:w-[450px]">
          <AnimatePresence mode="wait">
            {result ? (
              <motion.div
                key="result"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-white rounded-3xl border border-slate-100 shadow-xl overflow-hidden sticky top-6"
              >
                  <div className="p-8 bg-slate-900 text-white flex items-center justify-between">
                     <div className="flex items-center gap-2">
                        <CheckCircle size={18} className="text-emerald-400" />
                        <span className="text-[10px] font-bold uppercase tracking-widest">Execution Verified</span>
                     </div>
                     <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest opacity-50">Ref #{(result.id || result._id || "NEW").slice(-6).toUpperCase()}</span>
                  </div>
                  
                  <div className="p-10 space-y-10">
                    <div>
                        <h2 className="text-5xl font-bold tracking-tighter text-slate-900 mb-2">
                            {result.quantity} <span className="text-indigo-600">{result.symbol.replace(".NS", "")}</span>
                        </h2>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Average Fill: {formatINR(result.price)}</span>
                    </div>

                    <div className="space-y-6">
                        <div className="p-6 bg-slate-50 rounded-2xl border border-slate-100">
                           <div className="flex items-center gap-2 mb-3 text-indigo-600">
                               <ShieldCheck size={18} />
                               <span className="text-[10px] font-bold uppercase tracking-widest">Risk explanation</span>
                           </div>
                           <p className="text-[11px] text-slate-600 leading-relaxed font-medium">
                               {result.analysis?.explanation || "No immediate risk violations detected."}
                           </p>
                        </div>

                        <div className="p-6 bg-slate-50 rounded-2xl border border-slate-100">
                           <div className="flex items-center gap-2 mb-3 text-indigo-600">
                               <Brain size={18} />
                               <span className="text-[10px] font-bold uppercase tracking-widest">Mindset Audit</span>
                           </div>
                           <p className="text-[11px] text-slate-600 leading-relaxed italic font-medium">
                               {result.analysis?.humanBehavior || "Psychological profile building in progress."}
                           </p>
                        </div>
                    </div>

                    <button 
                        onClick={() => setResult(null)}
                        className="w-full py-4 text-slate-400 hover:text-slate-900 font-bold text-[10px] uppercase tracking-widest transition-all border-t border-slate-100"
                    >
                        Initiate New Plan
                    </button>
                  </div>
              </motion.div>
            ) : (
                <div className="bg-slate-900 rounded-[2.5rem] p-12 text-center sticky top-6 text-white min-h-[600px] flex flex-col justify-center gap-6">
                    <div className="w-20 h-20 bg-white/5 border border-white/10 rounded-3xl flex items-center justify-center mx-auto mb-4">
                        <Brain size={40} className="text-indigo-400" />
                    </div>
                    <h3 className="text-2xl font-black tracking-tight">AI Advisor Standby</h3>
                    <p className="text-slate-400 text-sm leading-relaxed font-medium px-4">
                        Upon execution, our detatched AI suite will provide a real-time risk diagnostic and psychological audit of your trade intent.
                    </p>
                    <div className="mt-6 flex flex-col gap-3">
                        <div className="flex items-center gap-3 px-6 py-4 bg-white/5 border border-white/10 rounded-2xl text-left">
                            <Zap size={16} className="text-indigo-400" />
                            <span className="text-[10px] font-bold uppercase tracking-widest">Latency-Free Transaction</span>
                        </div>
                        <div className="flex items-center gap-3 px-6 py-4 bg-white/5 border border-white/10 rounded-2xl text-left">
                            <ShieldCheck size={16} className="text-emerald-400" />
                            <span className="text-[10px] font-bold uppercase tracking-widest">Invariant Guard Enabled</span>
                        </div>
                    </div>
                </div>
            )}
          </AnimatePresence>
        </div>

      </div>

      {/* CONFIRMATION MODAL */}
      <AnimatePresence>
        {showConfirmModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowConfirmModal(false)}
              className="absolute inset-0 bg-slate-900/80 backdrop-blur-sm"
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="bg-white rounded-[2rem] w-full max-w-md overflow-hidden shadow-2xl relative z-10"
            >
               <div className={`p-8 text-white ${tradeType === 'BUY' ? 'bg-indigo-600' : 'bg-rose-600'}`}>
                  <div className="flex items-center justify-between mb-4">
                     <span className="text-[10px] font-black uppercase tracking-[0.3em]">Order Authorization</span>
                     <Zap size={20} />
                  </div>
                  <h3 className="text-3xl font-black tracking-tighter">Confirm {tradeType} Finalisation</h3>
               </div>
               
               <div className="p-10 space-y-8">
                  <div className="flex items-center justify-between">
                     <div>
                        <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Target Asset</span>
                        <span className="text-2xl font-black text-slate-900">{symbol}</span>
                     </div>
                     <div className="text-right">
                        <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Volume</span>
                        <span className="text-2xl font-black text-slate-900">{quantity}</span>
                     </div>
                  </div>

                  <div className="p-6 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-between">
                     <span className="text-xs font-bold text-slate-500">Estimated Value</span>
                     <span className="text-xl font-black text-slate-900">
                       {formatINR(parseFloat(quantity || 0) * parseFloat(price || 0))}
                     </span>
                  </div>

                  {tradeType === 'SELL' && (
                    <div className="p-6 bg-slate-50 rounded-2xl border border-dashed border-rose-200">
                       <span className="block text-[9px] font-bold text-rose-500 uppercase tracking-widest mb-2">Liquidation Protocol</span>
                       <p className="text-[11px] font-medium text-slate-600 leading-relaxed">
                          Executing this exit will realize any pending P&L and return liquid capital to your usable balance immediately.
                       </p>
                    </div>
                  )}

                  <div className="flex flex-col gap-3">
                    <button 
                       onClick={handleSubmit}
                       disabled={loading}
                       className={`w-full py-5 rounded-xl text-white font-bold text-xs uppercase tracking-[0.2em] shadow-xl transition-all ${tradeType === 'BUY' ? 'bg-indigo-600 shadow-indigo-500/20' : 'bg-rose-600 shadow-rose-500/20'}`}
                    >
                       {loading ? 'Committing...' : `Authorize ${tradeType} Execution`}
                    </button>
                    <button 
                       onClick={() => setShowConfirmModal(false)}
                       className="w-full py-4 text-slate-400 hover:text-slate-900 font-bold text-[10px] uppercase tracking-widest transition-all"
                    >
                       Abort Order
                    </button>
                  </div>
               </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default TradeForm;
