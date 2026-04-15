import { motion } from "framer-motion";
import {
  BookOpen,
  Brain,
  ShieldCheck,
  CheckCircle,
  BarChart2,
} from "lucide-react";
import { formatINR } from "../../utils/currency.utils";
import { ErrorState, EmptyState } from "../../components/common/ExperienceStates";
import { useJournal } from "../../hooks/useJournal";

/**
 * TRADING JOURNAL SYSTEM - LEARNING LOOP ACTIVE
 * Focuses on mistakes, insights, and systemic improvement.
 */
export default function JournalPage() {
  const {
    journalPayload,
    journal,
    entries,
    frequentPatterns,
    isLoading: journalLoading,
    isError,
    refetch,
  } = useJournal();

  if (isError) return <ErrorState onRetry={() => refetch()} />;

  return (
    <div className="app-page px-2 pt-4">
      <header className="mb-12 border-l-4 border-slate-900 pl-8">
        <h1 className="text-4xl font-black text-slate-900 tracking-tighter mb-2">Institutional Trading Journal</h1>
        <p className="text-slate-500 font-medium text-lg leading-relaxed max-w-2xl">
          Systemic Learning Hub: Reviewing round-trip executions through the lens of behavioral improvement and structural alignment.
        </p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 mb-16">
        <div className="lg:col-span-8 space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm">
              <span className="block text-[8px] font-black text-indigo-500 uppercase tracking-widest mb-4">Closed Trades</span>
              <h3 className="text-xl font-black text-slate-900">{journal?.totalClosed || 0}</h3>
              <span className="text-[10px] font-bold text-slate-400 mt-2 block">Round-trip entries recorded</span>
            </div>
            <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm">
              <span className="block text-[8px] font-black text-emerald-500 uppercase tracking-widest mb-4">Top Pattern</span>
              <h3 className="text-xl font-black text-slate-900 truncate">{frequentPatterns[0]?.type?.replace(/_/g, " ") || "NONE"}</h3>
              <span className="text-[10px] font-bold text-slate-400 mt-2 block">{frequentPatterns[0]?.count || 0} tagged reflections</span>
            </div>
            <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm">
              <span className="block text-[8px] font-black text-amber-500 uppercase tracking-widest mb-4">Pattern Spread</span>
              <h3 className="text-xl font-black text-slate-900">{frequentPatterns.length}</h3>
              <span className="text-[10px] font-bold text-slate-400 mt-2 block">Distinct reflection clusters</span>
            </div>
            <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm">
              <span className="block text-[8px] font-black text-rose-500 uppercase tracking-widest mb-4">Latest Verdict</span>
              <p className="text-[10px] font-black leading-tight text-slate-600 truncate">
                {entries?.[0]?.learningSurface?.verdict || "Awaiting first closed trade"}
              </p>
              <span className="text-[10px] font-bold text-slate-400 mt-2 block italic">Adapter-backed reflection</span>
            </div>
          </div>

          <div className="bg-white p-10 rounded-[3rem] border border-slate-100 shadow-sm">
            <div className="flex items-center gap-3 mb-8">
              <BarChart2 size={18} className="text-indigo-600" />
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">Mistake Frequency Matrix</span>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
              {frequentPatterns.map((pattern) => (
                <div key={pattern.type} className="bg-slate-50 p-6 rounded-[2rem] border border-slate-100 italic transition-all hover:border-indigo-200 group">
                  <span className="block text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1 group-hover:text-indigo-600">
                    {pattern.type.replace(/_/g, " ")}
                  </span>
                  <span className="text-2xl font-black text-slate-900">{pattern.count}</span>
                  <span className="block text-[8px] font-bold text-slate-300 mt-1 uppercase tracking-tighter">
                    {pattern.frequency}% frequency
                  </span>
                </div>
              ))}
              {frequentPatterns.length === 0 && (
                <div className="col-span-full p-10 text-center border border-dashed border-slate-200 rounded-3xl">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">No systemic patterns recorded yet.</p>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="lg:col-span-4 bg-slate-900 p-10 rounded-[3rem] text-white shadow-xl flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-3 mb-8">
              <ShieldCheck size={18} className="text-emerald-400" />
              <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em]">System Alignment</span>
            </div>
            <h2 className="text-4xl font-black tracking-tighter mb-2">{journalPayload?.state || "STABLE"}</h2>
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest leading-relaxed">
              Journal state derived from closed-trade reflections and pattern density.
            </p>
          </div>

          <div className="pt-8 border-t border-white/5 space-y-4">
            <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest">
              <span className="text-slate-500">Last Reflection</span>
              <span className="text-indigo-400">{entries?.[0]?.symbol || "NONE"}</span>
            </div>
            <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest">
              <span className="text-slate-500">Coverage</span>
              <span className="text-emerald-400">{journal?.totalClosed || 0} closed trades</span>
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-8 mb-20">
        <div className="flex items-center gap-3 mb-6 px-2">
          <BookOpen size={18} className="text-slate-400" />
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Detailed Learning Registry</span>
        </div>

        {journalLoading ? (
          [1, 2, 3].map((i) => <div key={i} className="h-48 bg-white rounded-[2.5rem] animate-pulse" />)
        ) : entries.length === 0 ? (
          <EmptyState message="No trades yet" detail="Close a trade to generate a learning reflection." />
        ) : (
          entries.map((trade, i) => (
            <motion.div
              key={`${trade.symbol}-${trade.closedAt}-${i}`}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.05 }}
              className="bg-white rounded-[3rem] border border-slate-100 shadow-sm overflow-hidden"
            >
              <div className="grid grid-cols-1 lg:grid-cols-12">
                <div className="lg:col-span-4 p-10 bg-slate-50 border-r border-slate-100">
                  <div className="flex items-center justify-between mb-8">
                    <div>
                      <h4 className="text-2xl font-black text-slate-900 tracking-tighter uppercase">{trade.symbol.split(".")[0]}</h4>
                      <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">
                        Closed: {trade.closedAt ? new Date(trade.closedAt).toLocaleDateString() : "N/A"}
                      </span>
                    </div>
                    <div className={`px-4 py-2 rounded-2xl text-[10px] font-black uppercase tracking-widest ${trade.pnlPaise >= 0 ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600"}`}>
                      {trade.pnlPaise >= 0 ? "+" : ""}{formatINR(trade.pnlPaise)}
                    </div>
                  </div>
                  <div className="space-y-4 pt-8 border-t border-slate-200/50">
                    <div className="flex justify-between items-center text-[10px] font-bold">
                      <span className="text-slate-400 uppercase tracking-widest">Execution Delta</span>
                      <span className={`font-black ${trade.pnlPaise >= 0 ? "text-emerald-500" : "text-rose-500"}`}>
                        {trade.pnlPct}% Efficiency
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-[10px] font-bold">
                      <span className="text-slate-400 uppercase tracking-widest">Plan R:R</span>
                      <span className={`px-1.5 py-0.5 rounded text-[8px] font-black ${trade.plan?.rr >= 2 ? "bg-emerald-500 text-white" : "bg-amber-500 text-white"}`}>
                        {trade.plan?.rr?.toFixed(2) || "N/A"}
                      </span>
                    </div>
                    <div className="space-y-3 pt-3 border-t border-slate-100">
                      <div className="flex justify-between items-center text-[9px] font-bold">
                        <span className="text-slate-400 uppercase tracking-widest">Actual Exit</span>
                        <span className="text-slate-900 font-black">{formatINR(trade.actual?.exitPaise || 0)}</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="p-2 bg-rose-50 rounded-lg border border-rose-100">
                          <span className="block text-[6px] font-black text-rose-400 uppercase mb-1">Plan SL</span>
                          <span className="text-[10px] font-black text-rose-600">{formatINR(trade.plan?.slPaise || 0)}</span>
                        </div>
                        <div className="p-2 bg-emerald-50 rounded-lg border border-emerald-100">
                          <span className="block text-[6px] font-black text-emerald-400 uppercase mb-1">Plan Target</span>
                          <span className="text-[10px] font-black text-emerald-600">{formatINR(trade.plan?.targetPaise || 0)}</span>
                        </div>
                      </div>
                    </div>
                    {trade.learningSurface?.tags?.length > 0 && (
                      <div className="flex flex-wrap gap-1 pt-3">
                        {trade.learningSurface.tags.map((tag) => (
                          <span key={tag} className="px-2 py-0.5 bg-indigo-50 text-indigo-600 rounded-md text-[7px] font-black uppercase tracking-tighter shadow-sm border border-indigo-100">
                            #{tag}
                          </span>
                        ))}
                      </div>
                    )}
                    <div className="pt-4 flex justify-between items-center border-t border-slate-100">
                      <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Final Verdict</span>
                      <span className="px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest bg-slate-200 text-slate-700">
                        {trade.learningSurface?.verdict || "NEUTRAL"}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="lg:col-span-8 p-10">
                  <div className="flex items-center gap-2 mb-6">
                    <div className="w-2 h-2 rounded-full bg-indigo-500" />
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Learning Reflection</span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                    <div className="space-y-6">
                      <div>
                        <span className="text-[8px] font-black text-indigo-600 uppercase tracking-widest block mb-2">Primary Mistake</span>
                        <p className="text-[11px] font-bold text-slate-600 leading-relaxed italic">
                          "{trade.learningSurface?.primaryMistake || "No primary issue recorded."}"
                        </p>
                      </div>
                      <div>
                        <span className="text-[8px] font-black text-indigo-600 uppercase tracking-widest block mb-2">Primary Insight</span>
                        <p className="text-sm font-black text-slate-900 leading-relaxed">
                          {trade.learningSurface?.insight || "The trade followed established systemic protocols."}
                        </p>
                      </div>
                    </div>

                    <div className="bg-slate-900 rounded-[2rem] p-8 text-white flex flex-col justify-between border border-indigo-500/30">
                      <div className="space-y-2">
                        <span className="text-[8px] font-black text-indigo-400 uppercase tracking-widest block">Systemic Improvement Rule</span>
                        <p className="text-xs font-bold leading-relaxed">{trade.learningSurface?.correction || "Maintain current discipline levels."}</p>
                      </div>
                      <div className="mt-6 flex items-center justify-between opacity-50">
                        <span className="text-[7px] font-bold uppercase tracking-[0.3em]">Confidence</span>
                        <span className="text-[10px] font-black">{trade.learningSurface?.confidence ?? 50}%</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          ))
        )}
      </div>
    </div>
  );
}
