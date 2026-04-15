import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, ShieldAlert, Terminal, ShieldCheck } from "lucide-react";

export default function DecisionPanel({ onClose, onConfirm, snapshot, isExecuting }) {
  if (!snapshot) return null;

  const warnings = Array.isArray(snapshot.warnings) ? snapshot.warnings : [];
  const signals = Array.isArray(snapshot.signals) ? snapshot.signals : [];
  const riskScore = Number(snapshot.riskScore || 0);
  const unavailable = riskScore === 0 && warnings.length === 0 && signals.length === 0;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[150] flex items-center justify-center p-6 bg-slate-900/80 backdrop-blur-xl">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 30 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 30 }}
          className="w-full max-w-[900px] bg-white rounded-[3.5rem] shadow-2xl overflow-hidden border border-slate-200 grid grid-cols-1 md:grid-cols-[1fr_320px]"
        >
          <div className="p-10 space-y-8">
            <header>
              <h2 className="text-2xl font-black text-slate-900 tracking-tight">Pre-Trade Decision Snapshot</h2>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Backend Contract Rendering Only</p>
            </header>

            <div className="rounded-3xl border border-slate-100 bg-slate-50 p-6">
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Risk Score</span>
              <div className="mt-2 text-4xl font-black text-slate-900">{riskScore}</div>
            </div>

            <div className="space-y-3">
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Signals</span>
              {signals.length === 0 ? (
                <p className="text-xs font-bold text-slate-500">No signal details returned.</p>
              ) : (
                signals.map((signal, idx) => (
                  <div key={`${signal}-${idx}`} className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4 text-xs font-bold text-emerald-700">
                    {signal}
                  </div>
                ))
              )}
            </div>

            <div className="space-y-3">
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Warnings</span>
              {warnings.length === 0 ? (
                <p className="text-xs font-bold text-slate-500">No warnings returned.</p>
              ) : (
                warnings.map((warning, idx) => (
                  <div key={`${warning}-${idx}`} className="rounded-2xl border border-amber-100 bg-amber-50 p-4 text-xs font-bold text-amber-700">
                    {warning}
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="bg-slate-900 p-10 text-white flex flex-col justify-between relative">
            <div className="absolute top-0 right-0 p-8 opacity-5">
              <Terminal size={120} />
            </div>

            <div className="relative z-10">
              <span className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.3em] mb-4 block">Execution Status</span>
              <div className="text-4xl font-black tracking-tight">{unavailable ? "UNAVAILABLE" : "READY"}</div>
              <p className="mt-4 text-xs font-bold text-slate-400">
                {unavailable ? "Decision limited due to missing signals." : "Server returned execution token and snapshot."}
              </p>
            </div>

            <div className="relative z-10 space-y-4 mt-12">
              <button
                onClick={onConfirm}
                disabled={unavailable || isExecuting}
                className="w-full py-5 rounded-2xl text-[11px] font-black uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-2 shadow-2xl bg-emerald-600 text-white disabled:bg-slate-700"
              >
                <ShieldCheck size={14} />
                Authorize Execution
                <ArrowRight size={16} />
              </button>
              <button
                onClick={onClose}
                className="w-full py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest hover:text-white transition-colors"
              >
                Abort Order
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
