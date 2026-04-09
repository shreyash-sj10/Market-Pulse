import { useQuery } from "@tanstack/react-query";
import { getMarketIndices } from "../../../services/market.api";
import { TrendingUp, TrendingDown, RefreshCcw } from "lucide-react";

export default function MarketStrip() {
  const { data: indices, isLoading, isError, isFetching } = useQuery({
    queryKey: ["market-indices"],
    queryFn: getMarketIndices,
    refetchInterval: 60000, // Sync every minute
    staleTime: 45000,
  });

  if (isLoading) {
    return (
      <div className="hidden lg:flex items-center gap-4 px-4 py-1.5 bg-slate-50/50 rounded-full border border-slate-100 animate-pulse">
        <div className="w-16 h-3 bg-slate-200 rounded" />
        <div className="w-16 h-3 bg-slate-200 rounded" />
        <div className="w-16 h-3 bg-slate-200 rounded" />
      </div>
    );
  }

  if (isError || !indices) return null;

  return (
    <div className="hidden lg:flex items-center gap-6 px-1 transition-all duration-500">
      {indices.map((item) => {
        const isUp = item.change >= 0;
        return (
          <div key={item.key} className="flex items-center gap-2 group cursor-default">
            <span className="text-[10px] font-black text-slate-400 tracking-tighter uppercase group-hover:text-slate-600 transition-colors">
              {item.key}
            </span>
            <div className={`flex items-center gap-1 font-bold text-xs ${isUp ? "text-emerald-600" : "text-rose-600"}`}>
              <span>{isUp ? "▲" : "▼"}</span>
              <span>{Math.abs(item.change).toFixed(1)}%</span>
            </div>
          </div>
        );
      })}
      
      {/* Tiny sync indicator */}
      <div className={`ml-1 transition-opacity duration-300 ${isFetching ? "opacity-100" : "opacity-0"}`}>
        <RefreshCcw size={10} className="text-blue-400 animate-spin" />
      </div>
    </div>
  );
}
