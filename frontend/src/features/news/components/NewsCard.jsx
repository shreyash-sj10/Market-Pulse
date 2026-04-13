import { ExternalLink, Clock, Newspaper, ArrowUpRight, TrendingUp, TrendingDown, Minus, ShieldCheck } from "lucide-react";
import { motion } from "framer-motion";

/**
 * PRODUCTION-GRADE NEWS CARD (POLISHED)
 * Enforces strict containment and visual hierarchy.
 */
export default function NewsCard({ news, featured = false }) {
  const formatTime = (isoString) => {
    const now = new Date();
    const past = new Date(isoString);
    const diffMs = now - past;
    const diffHrs = Math.floor(diffMs / (1000 * 60 * 60));

    if (diffHrs < 1) return "JUST IN";
    if (diffHrs === 1) return "1h ago";
    if (diffHrs < 24) return `${diffHrs}h ago`;
    return past.toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
  };

  const sentimentStyles = {
    BULLISH: { color: "text-emerald-500", bg: "bg-emerald-500/10", label: "BULLISH SIGNAL", icon: <TrendingUp size={12} /> },
    BEARISH: { color: "text-rose-500", bg: "bg-rose-500/10", label: "BEARISH SIGNAL", icon: <TrendingDown size={12} /> },
    NEUTRAL: { color: "text-slate-400", bg: "bg-slate-500/10", label: "NEUTRAL PULSE", icon: <Minus size={12} /> },
  };

  const unavailable = news?.status === "UNAVAILABLE";
  const sent = sentimentStyles[news?.impact] || sentimentStyles.NEUTRAL;
  const confidence = typeof news?.confidence === "number" ? news.confidence : null;
  const scope = news?.scope || "MARKET";
  const affectedAssets = news?.affectedAssets || news?.symbols || [];

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      className="group relative flex flex-col h-full bg-white border border-slate-200 rounded-[2rem] overflow-hidden hover:border-indigo-400 transition-all duration-500 hover:shadow-2xl hover:shadow-indigo-500/5"
    >
      <div className="relative h-48 sm:h-52 overflow-hidden bg-slate-100">
        {news?.image ? (
          <img
            src={news.image}
            alt=""
            loading="lazy"
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-1000 ease-out"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-slate-300">
            <Newspaper size={40} strokeWidth={1.5} />
          </div>
        )}

        <div className="absolute inset-0 bg-gradient-to-t from-slate-900/90 via-slate-900/20 to-transparent pointer-events-none" />

        <div className="absolute top-4 left-4 flex flex-wrap gap-2 z-20">
          <span className="px-2.5 py-1 bg-black/40 backdrop-blur-md rounded-lg text-[8px] font-black text-white uppercase tracking-[0.2em] border border-white/10">
            {news?.source || "SYSTEM"}
          </span>
          <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[8px] font-black uppercase tracking-[0.2em] border border-white/10 bg-black/40 text-white backdrop-blur-md">
            {unavailable ? "UNAVAILABLE" : sent.label}
          </span>
        </div>

        <div className="absolute bottom-4 left-5 right-5 z-20">
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-[9px] font-black text-indigo-400 uppercase tracking-widest">{news?.sector || "GENERAL"}</span>
            <div className="h-0.5 w-0.5 rounded-full bg-slate-500" />
            <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest">{scope}</span>
          </div>
          <h4 className="text-white text-base font-bold tracking-tight line-clamp-2 leading-tight group-hover:text-indigo-200 transition-colors">
            {news?.title || news?.event || "INTELLIGENCE NODE"}
          </h4>
        </div>
      </div>

      <div className="p-6 flex flex-col flex-grow bg-white relative z-10">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <Clock size={12} className="text-slate-400" />
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest leading-none">{formatTime(news?.time || new Date().toISOString())}</span>
          </div>
          <div className="flex items-center gap-2 bg-slate-50 px-2 py-1 rounded-lg">
            <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Conf.</span>
            {confidence === null ? (
              <span className="text-[10px] font-black text-amber-600">N/A</span>
            ) : (
              <>
                <div className="w-12 h-1 bg-slate-200 rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all duration-1000 ${confidence > 70 ? "bg-emerald-500" : confidence > 40 ? "bg-amber-500" : "bg-rose-500"}`}
                    style={{ width: `${confidence}%` }}
                  />
                </div>
                <span className="text-[10px] font-black text-slate-900">{confidence}%</span>
              </>
            )}
          </div>
        </div>

        <div className="relative mb-6 p-4 bg-slate-50 border border-slate-100 rounded-2xl group-hover:bg-slate-900 transition-all duration-500 group-hover:border-slate-800">
          <div className="absolute left-0 top-4 w-1 h-6 bg-indigo-500 rounded-r-full group-hover:h-8 transition-all" />
          <p className="text-[11px] font-bold text-slate-600 leading-relaxed group-hover:text-slate-400 transition-colors">
            {unavailable ? "Data not available. Decision limited due to missing signals." : (news?.reasoning || news?.judgment || "No rationale provided.")}
          </p>

          {affectedAssets.length > 0 && (
            <div className="mt-4 pt-3 border-t border-slate-200/50 group-hover:border-slate-800 flex items-center gap-2 overflow-hidden">
              <span className="text-[8px] font-black text-slate-400 uppercase tracking-[0.2em] shrink-0">Triggers:</span>
              <div className="flex gap-1.5 overflow-x-auto no-scrollbar">
                {affectedAssets.map((asset, idx) => (
                  <span key={idx} className="text-[9px] font-black text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md whitespace-nowrap group-hover:bg-indigo-500/10 group-hover:text-indigo-400">
                    {asset}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="mt-auto pt-4 flex items-center justify-between border-t border-slate-50">
          <div className="flex items-center gap-1.5">
            <ShieldCheck size={14} className="text-emerald-500/80" />
            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Validated Node</span>
          </div>

          {news?.url ? (
            <a
              href={news.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-[9px] font-black text-indigo-600 hover:text-indigo-700 uppercase tracking-[0.2em] group/link transition-colors"
            >
              Review Trace <ArrowUpRight size={14} className="group-hover/link:translate-x-0.5 group-hover/link:-translate-y-0.5 transition-transform" />
            </a>
          ) : (
            <span className="text-[9px] font-black text-amber-600 uppercase tracking-[0.2em]">Data not available</span>
          )}
        </div>
      </div>
    </motion.div>
  );
}
