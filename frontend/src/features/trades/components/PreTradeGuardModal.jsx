import React from 'react';
import { ShieldAlert, AlertTriangle, Info, X, Zap, ArrowRight, ShieldCheck } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { formatINR } from '../../../utils/currency.utils';

export default function PreTradeGuardModal({ isOpen, onClose, onConfirm, riskData, tradeRequest }) {
  if (!isOpen || !riskData) return null;

  const { riskLevel, reasoning, flags, confidence } = riskData;

  const riskStyles = {
    HIGH: {
      color: "text-rose-600",
      bg: "bg-rose-50",
      border: "border-rose-100",
      icon: <ShieldAlert className="text-rose-600" size={32} />,
      btn: "bg-rose-600 hover:bg-rose-700 shadow-rose-200"
    },
    MEDIUM: {
      color: "text-amber-600",
      bg: "bg-amber-50",
      border: "border-amber-100",
      icon: <AlertTriangle className="text-amber-600" size={32} />,
      btn: "bg-amber-600 hover:bg-amber-700 shadow-amber-200"
    },
    LOW: {
      color: "text-emerald-600",
      bg: "bg-emerald-50",
      border: "border-emerald-100",
      icon: <ShieldCheck className="text-emerald-600" size={32} />,
      btn: "bg-emerald-600 hover:bg-emerald-700 shadow-emerald-200"
    }
  };

  const style = riskStyles[riskLevel] || riskStyles.LOW;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-900/60 backdrop-blur-sm">
        <motion.div 
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          className="w-full max-w-lg bg-white rounded-[3rem] shadow-2xl overflow-hidden border border-slate-100"
        >
          {/* Header */}
          <div className={`p-10 ${style.bg} border-b ${style.border} relative`}>
             <button onClick={onClose} className="absolute top-8 right-8 text-slate-400 hover:text-slate-600 transition-colors">
                <X size={20} />
             </button>
             <div className="flex items-center gap-6">
                <div className="p-4 bg-white rounded-3xl shadow-xl shadow-slate-200/50">
                   {style.icon}
                </div>
                <div>
                   <h2 className={`text-2xl font-black uppercase tracking-tight ${style.color}`}>Pre-Trade Guard</h2>
                   <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">{riskLevel} Risk Detected • {confidence}% Confidence</p>
                </div>
             </div>
          </div>

          {/* Body */}
          <div className="p-10 space-y-8">
             <div className="space-y-4">
                <div className="flex items-center gap-2 text-slate-400">
                   <Zap size={14} />
                   <span className="text-[10px] font-black uppercase tracking-widest">Intelligence Intercept</span>
                </div>
                <div className="space-y-3">
                   {reasoning.map((r, i) => (
                      <div key={i} className={`p-4 ${style.bg} border-l-4 ${style.border} rounded-r-2xl flex items-start gap-3`}>
                         <div className={`mt-1 w-1.5 h-1.5 rounded-full ${style.color.replace('text', 'bg')}`} />
                         <p className={`text-[13px] font-bold ${style.color} leading-relaxed`}>{r}</p>
                      </div>
                   ))}
                </div>
             </div>

             {/* Behavioral Layer */}
             {flags.length > 0 && (
                <div className="p-6 bg-slate-50 rounded-3xl border border-slate-100">
                   <div className="flex items-center gap-2 mb-3 text-slate-400">
                      <Info size={14} />
                      <span className="text-[10px] font-black uppercase tracking-widest">Behavioral Flags</span>
                   </div>
                   <div className="flex flex-wrap gap-2">
                      {flags.map(f => (
                         <span key={f} className="px-3 py-1 bg-white border border-slate-200 text-slate-500 text-[10px] font-black rounded-full uppercase tracking-tighter">
                            {f.replace(/_/g, " ")}
                         </span>
                      ))}
                   </div>
                </div>
             )}

             {/* Intent Summary */}
             <div className="flex items-center justify-between p-6 bg-indigo-50/30 rounded-3xl border border-indigo-100/50">
                <div className="text-left">
                   <p className="text-[8px] font-black text-indigo-400 uppercase tracking-widest">Trading Intent</p>
                   <p className="text-lg font-black text-indigo-900">{tradeRequest.side} {tradeRequest.quantity} {tradeRequest.symbol}</p>
                </div>
                <ArrowRight className="text-indigo-200" />
                <div className="text-right">
                   <p className="text-[8px] font-black text-indigo-400 uppercase tracking-widest">Current Market</p>
                   <p className="text-lg font-black text-indigo-900">{formatINR(parseFloat(tradeRequest.price) * 100)}</p>
                </div>
             </div>
          </div>

          {/* Actions */}
          <div className="p-10 pt-0 flex flex-col gap-3">
             <button 
                onClick={onConfirm}
                className={`w-full py-5 rounded-2xl text-white text-xs font-black uppercase tracking-widest transition-all shadow-xl ${style.btn}`}
             >
                I Understand, Proceed Anyway
             </button>
             <button 
                onClick={onClose}
                className="w-full py-5 text-slate-400 text-[10px] font-black uppercase tracking-[0.2em] hover:text-slate-600 transition-colors"
             >
                Cancel Trade Execution
             </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
