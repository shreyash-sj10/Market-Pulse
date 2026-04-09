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

  if (!data?.news?.length) return null;

  return (
    <div className="bg-white rounded-[3rem] p-10 border border-slate-100 shadow-sm">
      <div className="flex items-center justify-between mb-8">
         <div className="flex items-center gap-3">
            <div className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl">
               <ShieldAlert size={20} />
            </div>
            <div>
               <h3 className="text-lg font-black text-slate-900 tracking-tight">Impact on Your Portfolio</h3>
               <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Critical active holding intel</p>
            </div>
         </div>
      </div>

      <div className="space-y-4">
        {data.news.map((item, idx) => (
          <a
            key={idx}
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            className="group flex items-start gap-4 p-5 hover:bg-slate-50 rounded-2xl transition-all border border-transparent hover:border-slate-100"
          >
            <div className={`mt-1.5 shrink-0 w-2 h-2 rounded-full ${
               item.sentiment === 'BULLISH' ? 'bg-emerald-500' :
               item.sentiment === 'BEARISH' ? 'bg-rose-500' : 'bg-slate-300'
            }`} title={item.sentiment} />
            
            <div className="flex-1">
               <h4 className="text-[13px] font-bold text-slate-900 leading-snug group-hover:text-indigo-600 transition-colors mb-2">
                  {item.headline}
               </h4>
               <div className="flex items-center gap-3">
                  <span className="text-[9px] font-black text-indigo-500 uppercase tracking-widest">{item.source}</span>
                  <div className="w-1 h-1 rounded-full bg-slate-200" />
                  <span className="text-[9px] font-bold text-slate-400 uppercase">{new Date(item.timestamp).toLocaleDateString()}</span>
               </div>
            </div>
            <ExternalLink size={14} className="text-slate-200 group-hover:text-slate-400 transition-colors" />
          </a>
        ))}
      </div>
    </div>
  );
};

export default PortfolioNews;
