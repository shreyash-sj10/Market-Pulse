import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getMarketNews } from "../../services/market.api";
import NewsCard from "./components/NewsCard";
import { Search, TrendingUp, Newspaper, AlertCircle, Bot, Sparkles } from "lucide-react";
import { motion } from "framer-motion";

export default function NewsPage() {
  const [searchTerm, setSearchTerm] = useState("");

  const { data: news, isLoading, isError, refetch } = useQuery({
    queryKey: ["market-news", "a0019e60-fd57-4751-b14f-e33bb2ae0fb1"],
    queryFn: getMarketNews,
    staleTime: 1000 * 60 * 10,
  });

  const filteredNews = news?.filter((item) =>
    item.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.summary?.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

  if (isLoading) {
    return (
      <div className="flex flex-col gap-10 animate-pulse p-4">
        <div className="h-16 w-full bg-slate-100 rounded-[2.5rem]" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="h-96 bg-slate-50 rounded-[2rem]" />
          ))}
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="h-[60vh] flex flex-col items-center justify-center gap-4 text-center">
        <div className="p-6 bg-rose-50 text-rose-500 rounded-full shadow-lg shadow-rose-500/10 mb-2">
          <AlertCircle size={40} />
        </div>
        <div>
          <h3 className="text-xl font-black text-slate-900 tracking-tight">Signal Interrupted</h3>
          <p className="text-slate-500 font-medium max-w-xs mt-1">We couldn't reach the intelligence server. Check your link.</p>
        </div>
        <button 
          onClick={() => refetch()}
          className="mt-4 px-8 py-3 bg-slate-900 text-white rounded-full text-xs font-black uppercase tracking-widest hover:bg-slate-800 transition-all shadow-xl shadow-slate-900/20"
        >
          Re-establish Link
        </button>
      </div>
    );
  }

  const featuredArticle = filteredNews[0];
  const otherNews = filteredNews.slice(1);

  return (
    <div className="flex flex-col gap-12 pb-24">
      {/* Header & Advanced Filter */}
      <div className="flex flex-col xl:flex-row xl:items-end justify-between gap-8">
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Sparkles size={16} className="text-blue-600" />
            <span className="text-[10px] font-black text-blue-600 uppercase tracking-[0.2em]">Live Intelligence Terminal</span>
          </div>
          <h1 className="text-5xl font-black text-slate-900 tracking-tighter leading-none">
            Market <span className="text-blue-600">Sync.</span>
          </h1>
          <p className="text-slate-500 font-bold max-w-xl text-lg leading-relaxed">
            Real-time behavioral sentiment and financial news aggregation for elite equity and commodity strategy.
          </p>
        </div>
        
        <div className="relative group min-w-[360px]">
          <div className="absolute inset-y-0 left-6 flex items-center pointer-events-none text-slate-400 group-focus-within:text-blue-500 transition-colors">
            <Search size={20} />
          </div>
          <input
            type="text"
            placeholder="Search market intelligence..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-white border-2 border-slate-100 rounded-[2rem] py-5 pl-16 pr-8 text-sm font-black text-slate-800 placeholder:text-slate-300 placeholder:font-bold focus:outline-none focus:ring-8 focus:ring-blue-500/5 focus:border-blue-500 transition-all shadow-xl shadow-slate-100/50"
          />
        </div>
      </div>

      {/* Main Intel Section */}
      {filteredNews.length > 0 ? (
        <div className="flex flex-col gap-10">
          {/* Featured Article */}
          {!searchTerm && featuredArticle && (
            <div className="w-full">
               <NewsCard news={featuredArticle} featured={true} />
            </div>
          )}

          {/* Grid for Other Articles */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {(searchTerm ? filteredNews : otherNews).map((item) => (
              <NewsCard key={item.id} news={item} />
            ))}
          </div>
        </div>
      ) : (
        <div className="h-96 flex flex-col items-center justify-center text-slate-400 bg-slate-50/50 rounded-[3rem] border-4 border-dashed border-slate-100">
          <Bot size={64} strokeWidth={1} className="mb-6 opacity-20" />
          <h4 className="text-lg font-black text-slate-800 uppercase tracking-widest leading-none mb-2">Null Sector</h4>
          <p className="text-sm font-bold text-slate-400">Our satellites found no matching transmissions.</p>
        </div>
      )}

      {/* Behavioral Footer Note */}
      <div className="p-8 bg-slate-900 rounded-[2.5rem] text-white overflow-hidden relative">
         <div className="absolute top-0 right-0 p-10 opacity-5">
            <Newspaper size={200} />
         </div>
         <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-2">
               <span className="text-[10px] font-black uppercase tracking-[0.3em] text-blue-400">Information Theory</span>
               <h4 className="text-xl font-black tracking-tight">Stay Disciplined. Trade the Signal, not the Noise.</h4>
            </div>
            <div className="flex items-center gap-2 px-6 py-3 bg-white/10 rounded-full border border-white/10 backdrop-blur-sm">
               <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
               <span className="text-[10px] font-black uppercase tracking-widest text-slate-300">Sync Frequency: 1.2ms</span>
            </div>
         </div>
      </div>
    </div>
  );
}
