import { TrendingUp, TrendingDown } from "lucide-react";
import { motion } from "framer-motion";
import { formatINR } from "../../utils/currency.utils";

export default function MarketTickerTape({ indices = [], isLoading = false }) {
  const MotionDiv = motion.div;

  if (isLoading) {
    return <div className="h-full bg-slate-50 border-x border-slate-100 animate-pulse w-full" />;
  }

  // Part 1, Task 1 & 2: Defensive guards
  const safeIndices = Array.isArray(indices) ? indices : [];

  if (safeIndices.length === 0) {
    return (
      <div className="h-full flex items-center px-6 bg-slate-50 border-x border-slate-100">
         <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Market data temporarily unavailable (Part 5, Task 1)</span>
      </div>
    );
  }

  // Duplicate for seamless loop
  const tickerItems = [...safeIndices, ...safeIndices, ...safeIndices];

  return (
    <div className="h-full w-full bg-white overflow-hidden flex items-center">
      <MotionDiv
        animate={{ x: "-33.333%" }}
        transition={{ duration: 35, repeat: Infinity, ease: "linear" }}
        className="flex whitespace-nowrap items-center px-4"
      >
        {tickerItems.map((item, index) => {
          const isUp = item.change >= 0;
          return (
            <div key={`${item.symbol}-${index}`} className="flex items-center gap-4 px-8 border-r border-slate-100">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">
                {item.symbol}
              </span>
              <div className="flex items-center gap-2">
                <span className="text-xs font-black text-slate-900">
                  {typeof item.pricePaise === "number" ? formatINR(item.pricePaise) : "---"}
                </span>
                <div className={`flex items-center gap-1 text-[10px] font-black ${isUp ? 'text-emerald-500' : 'text-rose-500'}`}>
                  {isUp ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
                  <span>{item.changePercent.toFixed(2)}%</span>
                </div>
              </div>
            </div>
          );
        })}
      </MotionDiv>
    </div>
  );
}
