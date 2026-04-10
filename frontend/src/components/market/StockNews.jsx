import React, { useState, useEffect, memo } from 'react';
import axios from 'axios';
import { Newspaper, TrendingUp, TrendingDown, Clock, ExternalLink } from "lucide-react";

function StockNews({ symbol = "RELIANCE" }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const cleanSymbol = symbol.includes(":") ? symbol.split(":")[1] : symbol;

  useEffect(() => {
    const fetchNews = async () => {
      setLoading(true);
      try {
        const token = localStorage.getItem('token');
        const res = await axios.get(`${import.meta.env.VITE_BACKEND_URL}/market/news?symbol=${cleanSymbol}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setData(res.data);
      } catch (err) {
        console.error("News fetch failed:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchNews();
  }, [cleanSymbol]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-[400px] gap-4 bg-slate-50/50 rounded-2xl border border-slate-100 animate-pulse">
         <div className="p-4 bg-slate-100 rounded-full">
            <Newspaper className="text-slate-300" size={32} />
         </div>
         <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Ingesting News Feed...</span>
      </div>
    );
  }

  if (!data?.news?.length) {
    return (
      <div className="flex flex-col items-center justify-center h-[400px] gap-4 bg-white rounded-2xl border border-slate-100">
         <div className="p-4 bg-slate-50 rounded-full">
            <Newspaper className="text-slate-200" size={32} />
         </div>
         <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">No Recent Intel Available</span>
      </div>
    );
  }

  return (
    <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
      {/* Sentiment Summary Header */}
      <div className="flex items-center justify-between mb-6 px-1">
         <div>
            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 leading-none">Intelligence Hub</h3>
            <p className="text-xs font-bold text-slate-900">Live Narrative Audit</p>
         </div>
         <div className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest border ${
            data.sentimentSummary.includes('POSITIVE') ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 
            data.sentimentSummary.includes('NEGATIVE') ? 'bg-rose-50 text-rose-600 border-rose-100' : 
            'bg-slate-50 text-slate-500 border-slate-100'
         }`}>
            Sentiment: {data.sentimentSummary.replace('_', ' ')}
         </div>
      </div>

      <div className="grid gap-3">
        {data.news.filter(item => item.relevance === 'HIGH').map((item, idx) => (
          <a
            key={idx}
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            className="group block p-5 bg-white border border-slate-100 rounded-2xl hover:border-indigo-200 hover:shadow-xl hover:shadow-indigo-600/5 transition-all relative overflow-hidden"
          >
            {/* Sentiment Marker Stripe */}
            <div className={`absolute left-0 top-0 bottom-0 w-1 ${
              item.sentiment === 'BULLISH' ? 'bg-emerald-500' : 
              item.sentiment === 'BEARISH' ? 'bg-rose-500' : 'bg-slate-200'
            }`} />

            <div className="flex flex-col gap-3">
              <div className="flex items-start justify-between gap-4">
                <h4 className="text-[13px] font-bold text-slate-900 leading-snug group-hover:text-indigo-600 transition-colors">
                  {item.headline}
                </h4>
                <div className={`shrink-0 p-1.5 rounded-lg border ${
                   item.sentiment === 'BULLISH' ? 'bg-emerald-50 border-emerald-100 text-emerald-600' :
                   item.sentiment === 'BEARISH' ? 'bg-rose-50 border-rose-100 text-rose-600' :
                   'bg-slate-50 border-slate-100 text-slate-400'
                }`}>
                   {item.sentiment === 'BULLISH' ? <TrendingUp size={14} /> : 
                    item.sentiment === 'BEARISH' ? <TrendingDown size={14} /> : 
                    <ExternalLink size={14} />}
                </div>
              </div>

              <div className="flex items-center gap-4">
                 <div className="flex items-center gap-1.5">
                    <Clock size={12} className="text-slate-400" />
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                       {item.timestamp ? new Date(item.timestamp).toLocaleDateString() : 'Recent'}
                    </span>
                 </div>
                 <div className="w-1 h-1 rounded-full bg-slate-200" />
                 <span className="text-[10px] font-black text-indigo-500/80 uppercase tracking-widest">{item.source}</span>
                 
                 <div className="ml-auto px-2 py-0.5 bg-indigo-600 text-white text-[8px] font-black rounded-md uppercase tracking-[0.1em]">
                    High Relevance
                 </div>
              </div>
            </div>
          </a>
        ))}
      </div>
    </div>
  );
}

export default memo(StockNews);
