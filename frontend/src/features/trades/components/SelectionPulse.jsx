import React from 'react';
import { CheckCircle2, Circle, ArrowRight } from 'lucide-react';
import { motion } from 'framer-motion';

/**
 * PRODUCTION-GRADE STEP INDICATOR
 * Displays the current stage of the trade deployment pipeline.
 */
export default function SelectionPulse({ tradeType, step }) {
   const steps = [
      { id: 1, label: "Parameter Selection", detail: "Quant/Price Sync" },
      { id: 2, label: "Intelligence Review", detail: "Risk Interception" },
      { id: 3, label: "Atomic Execution", detail: "Synchronization" }
   ];

   return (
      <div className="flex flex-col md:flex-row items-center justify-between gap-8 mb-16 p-8 bg-slate-50 border border-slate-100 rounded-[3rem]">
         {steps.map((s, i) => {
            const isActive = step === s.id;
            const isCompleted = step > s.id;

            return (
               <React.Fragment key={s.id}>
                  <div className="flex items-center gap-6 relative">
                     <div className={`w-16 h-16 rounded-[1.5rem] flex items-center justify-center transition-all duration-500 shadow-xl ${isCompleted ? "bg-emerald-600 text-white shadow-emerald-200" :
                           isActive ? (tradeType === "BUY" ? "bg-indigo-600 text-white shadow-indigo-200" : "bg-rose-600 text-white shadow-rose-200") :
                              "bg-white text-slate-300"
                        }`}>
                        {isCompleted ? <CheckCircle2 size={24} /> : <span className="font-black text-xl">{s.id}</span>}
                     </div>
                     <div>
                        <h4 className={`text-sm font-black tracking-tight ${isActive ? "text-slate-900" : "text-slate-400"}`}>{s.label}</h4>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{s.detail}</p>
                     </div>
                  </div>
                  {i < steps.length - 1 && (
                     <div className="hidden xl:block">
                        <ArrowRight className={`text-slate-200 transition-all ${isCompleted ? "text-emerald-500" : ""}`} />
                     </div>
                  )}
               </React.Fragment>
            );
         })}
      </div>
   );
}
