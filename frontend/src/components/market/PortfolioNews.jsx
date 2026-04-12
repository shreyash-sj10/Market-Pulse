import React from 'react';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { Newspaper, TrendingUp, TrendingDown, Clock, ExternalLink, ShieldAlert } from "lucide-react";

const fetchPortfolioNews = async () => {
  const token = localStorage.getItem('token');
  const res = await axios.get(`${import.meta.env.VITE_BACKEND_URL}/market/news/portfolio`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  return res.data;
};

const PortfolioNews = () => {
  const { data, isLoading } = useQuery({
    queryKey: ["portfolioNews"],
    queryFn: fetchPortfolioNews,
    refetchInterval: 600000 // 10 minutes cache aligned
  });

  if (isLoading) {
    return (
      <div className="bg-white rounded-[3rem] p-10 border border-slate-100 shadow-sm animate-pulse">
        <div className="h-6 w-40 bg-slate-50 rounded mb-8" />
        <div className="space-y-4">
          <div className="h-24 bg-slate-50 rounded-2xl" />
          <div className="h-24 bg-slate-50 rounded-2xl" />
        </div>
      </div>
    );
  }

  const signals = data?.signals || [];

  if (signals.length === 0) return null;

  return (
    <div className="bg-white rounded-[3rem] p-10 border border-slate-100 shadow-sm">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl">
            <ShieldAlert size={20} />
          </div>
          <div>
            <h3 className="text-lg font-black text-slate-900 tracking-tight">Active Strategic Signals</h3>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Cross-Sector Intelligence Alignment</p>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        {signals.map((item, idx) => (
          <div
            key={idx}
            className="group flex items-start gap-4 p-5 hover:bg-slate-50 rounded-2xl transition-all border border-transparent hover:border-slate-100"
          >
            <div className={`mt-1.5 shrink-0 w-2 h-2 rounded-full ${item.impact === 'BULLISH' ? 'bg-emerald-500' :
                item.impact === 'BEARISH' ? 'bg-rose-500' : 'bg-slate-300'
              }`} title={item.impact} />

            <div className="flex-1">
              <h4 className="text-[13px] font-black text-slate-900 leading-snug group-hover:text-indigo-600 transition-colors mb-1">
                {item.symbols?.[0]}: {item.event}
              </h4>
              <p className="text-[10px] font-medium text-slate-500 line-clamp-2 mb-3 leading-relaxed">
                 {item.mechanism}
              </p>
              <div className="flex items-center gap-3">
                <span className={`text-[8px] font-black px-2 py-0.5 rounded ${item.impact === 'BULLISH' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                   CONFIDENCE: {item.confidence}%
                </span>
                <div className="w-1 h-1 rounded-full bg-slate-200" />
                <span className="text-[9px] font-bold text-slate-400 uppercase">{new Date(item.time).toLocaleDateString()}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default PortfolioNews;
