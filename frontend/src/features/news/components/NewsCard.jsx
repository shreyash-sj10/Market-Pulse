import { ExternalLink, Clock, Newspaper, ArrowUpRight, Activity } from "lucide-react";
import { motion } from "framer-motion";

export default function NewsCard({ news, featured = false }) {
  const formatTime = (isoString) => {
    const now = new Date();
    const past = new Date(isoString);
    const diffMs = now - past;
    const diffHrs = Math.floor(diffMs / (1000 * 60 * 60));
    
    if (diffHrs < 1) return "Just now";
    if (diffHrs === 1) return "1h ago";
    if (diffHrs < 24) return `${diffHrs}h ago`;
    return past.toLocaleDateString();
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      className={`group bg-white border border-slate-200 rounded-[2rem] overflow-hidden hover:shadow-2xl hover:shadow-blue-500/10 hover:-translate-y-1 transition-all duration-500 flex ${featured ? 'flex-col lg:flex-row' : 'flex-col'} h-full`}
    >
      {/* Article Image / Placeholder */}
      <div className={`${featured ? 'h-72 lg:h-auto lg:w-1/2' : 'h-52'} w-full bg-slate-100 overflow-hidden relative grayscale group-hover:grayscale-0 transition-all duration-1000`}>
        {news.image ? (
          <img src={news.image} alt={news.title} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-1000" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-slate-300">
            <Newspaper size={48} strokeWidth={1} />
          </div>
        )}
        <div className="absolute top-6 left-6">
          <span className="px-3 py-1.5 bg-white/90 backdrop-blur-md text-[10px] font-black text-slate-900 uppercase rounded-full shadow-lg border border-white/20 tracking-widest">
            {news.source}
          </span>
        </div>
      </div>

      {/* Content */}
      <div className={`p-8 lg:p-10 flex flex-col flex-1 ${featured ? 'justify-center' : ''}`}>
        <div className="flex items-center gap-3 mb-4">
           <div className="h-0.5 w-6 bg-blue-600 group-hover:w-12 transition-all duration-500" />
           <div className="flex items-center gap-1.5 text-slate-400 text-[10px] font-black uppercase tracking-widest">
             <Clock size={12} />
             <span>{formatTime(news.time)}</span>
           </div>
        </div>

        <h3 className={`${featured ? 'text-2xl lg:text-3xl' : 'text-xl'} font-black text-slate-900 leading-tight mb-4 group-hover:text-blue-600 transition-colors line-clamp-3 tracking-tight`}>
          {news.title}
        </h3>
        
        <p className={`${featured ? 'text-base' : 'text-sm'} text-slate-500 leading-relaxed mb-8 line-clamp-3 font-medium`}>
          {news.summary || "This specialized intelligence briefing provides real-time updates and behavioral signals for active market participants."}
        </p>

        {/* Footer */}
        <div className="mt-auto flex items-center justify-between">
           <a
            href={news.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-xs font-black text-slate-900 uppercase tracking-widest hover:text-blue-600 transition-colors group/link"
          >
            Full Intel
            <ArrowUpRight size={16} className="group-hover/link:translate-x-0.5 group-hover/link:-translate-y-0.5 transition-transform" />
          </a>
          
          <div className="p-3 bg-slate-50 text-slate-400 rounded-2xl group-hover:bg-blue-50 group-hover:text-blue-600 transition-colors">
            <Activity size={16} />
          </div>
        </div>
      </div>
    </motion.div>
  );
}
