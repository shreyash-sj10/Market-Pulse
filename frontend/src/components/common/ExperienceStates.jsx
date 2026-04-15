import React from 'react';
import { AlertCircle, Database, Search } from 'lucide-react';

export const ErrorState = ({ message = "Unable to load data", onRetry }) => (
  <div className="py-20 flex flex-col items-center text-center px-4 space-y-4 animate-in fade-in duration-500">
    <div className="w-16 h-16 bg-rose-50 rounded-full flex items-center justify-center text-rose-500">
      <AlertCircle size={32} />
    </div>
    <div className="space-y-2">
      <h3 className="text-xl font-black text-slate-900 tracking-tight">{message}</h3>
      <p className="text-sm font-bold text-slate-400 uppercase tracking-widest leading-relaxed max-w-xs mx-auto">
        System integrity check failed. Connection to master ledger interrupted.
      </p>
    </div>
    {onRetry && (
      <button 
        onClick={onRetry}
        className="mt-4 px-6 py-3 bg-slate-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-800 transition-all shadow-xl shadow-slate-200"
      >
        Retry Synchronization
      </button>
    )}
  </div>
);

export const EmptyState = ({ message = "No data yet", detail = "Close a trade to generate a learning reflection." }) => (
  <div className="py-24 text-center bg-slate-50 rounded-[3rem] border border-dashed border-slate-200 animate-in fade-in duration-700">
    <Database size={48} className="mx-auto text-slate-200 mb-6" />
    <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight">{message}</h3>
    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-2">{detail}</p>
  </div>
);

export const MismatchState = ({ onRetry }) => (
  <div className="py-20 flex flex-col items-center text-center px-4 space-y-4">
    <div className="w-16 h-16 bg-amber-50 rounded-full flex items-center justify-center text-amber-500">
      <Search size={32} />
    </div>
    <div className="space-y-2">
      <h3 className="text-xl font-black text-slate-900 tracking-tight">Data format error — retry</h3>
      <p className="text-sm font-bold text-slate-400 uppercase tracking-widest leading-relaxed max-w-xs mx-auto">
        Payload contract mismatch detected between client and system source.
      </p>
    </div>
    <button 
      onClick={onRetry}
      className="mt-4 px-6 py-3 bg-amber-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-amber-700 transition-all shadow-xl shadow-amber-100"
    >
      Re-Verify Contract
    </button>
  </div>
);

/**
 * Part 4: System Degraded Mode UI
 */
export const DegradedState = ({ message = "SYSTEM STATUS: DEGRADED" }) => (
  <div className="sticky top-0 z-[100] bg-amber-500 text-white py-2 px-4 shadow-lg animate-in slide-in-from-top duration-300">
    <div className="max-w-7xl mx-auto flex items-center justify-center gap-4">
       <AlertCircle size={14} />
       <span className="text-[10px] font-black uppercase tracking-[0.2em]">{message}</span>
       <span className="text-[9px] font-bold opacity-80 uppercase tracking-widest hidden sm:inline">Infrastructure failure detected — Core trading logic preserved</span>
    </div>
  </div>
);
