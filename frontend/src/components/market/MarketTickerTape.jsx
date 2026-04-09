import { useQuery } from "@tanstack/react-query";
import { getMarketIndices } from "../../services/market.api";
import { TrendingUp, TrendingDown } from "lucide-react";
import { motion } from "framer-motion";

export default function MarketTickerTape() {
  const { data: indices, isLoading } = useQuery({
    queryKey: ["market-indices-ticker"],
    queryFn: getMarketIndices,
    refetchInterval: 30000, 
  });

  if (isLoading || !indices || indices.length === 0) {
    return <div className="h-full bg-slate-50 border-x border-slate-100 animate-pulse w-full" />;
  }

  // Duplicate for seamless loop
  const tickerItems = [...indices, ...indices, ...indices];

  return (
    <div className="h-full w-full bg-white overflow-hidden flex items-center">
      <motion.div 
        animate={{ x: "-33.333%" }}
        transition={{ duration: 35, repeat: Infinity, ease: "linear" }}
        className="flex whitespace-nowrap items-center px-4"
      >
        {tickerItems.map((item, index) => {
          const isUp = item.change >= 0;
          return (
            <div key={`${item.key}-${index}`} className="flex items-center gap-4 px-8 border-r border-slate-100">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">
                {item.key}
              </span>
              <div className="flex items-center gap-2">
                <span className="text-xs font-black text-slate-900">
                   {item.price !== null ? (
                     `${item.currency === 'INR' ? '₹' : item.currency === 'USD' ? '$' : ''}${item.price.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}`
                   ) : '---'}
                </span>
                <div className={`flex items-center gap-1 text-[10px] font-black ${isUp ? 'text-emerald-500' : 'text-rose-500'}`}>
                  {isUp ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
                  <span>{Math.abs(item.change).toFixed(2)}%</span>
                </div>
              </div>
            </div>
          );
        })}
      </motion.div>
    </div>
  );
}
