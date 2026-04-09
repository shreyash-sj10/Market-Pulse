import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { getHistoricalPrices } from "../../../services/market.api";
import { calculateEMA } from "../../../utils/chartHelpers";
import { calculateRSI } from "../utils/indicators";
import { Info, Gauge } from "lucide-react";

export default function TradeInsight({ symbol, trade }) {
  const { data: rawPrices, isLoading } = useQuery({
    queryKey: ["price-history", symbol],
    queryFn: () => getHistoricalPrices(symbol.toUpperCase()),
    enabled: !!symbol,
    staleTime: 1000 * 60 * 5,
  });

  const insight = useMemo(() => {
    if (!rawPrices || rawPrices.length === 0 || !trade) return null;

    // 1. Calculate Indicators
    let data = calculateEMA(rawPrices, 20);
    data = calculateRSI(data, 14);

    // 2. Map trade to nearest date point
    // We assume the trade date from createdAt (YYYY-MM-DD or most recent point)
    const tradeDate = trade.createdAt ? new Date(trade.createdAt).toISOString().split("T")[0] : null;
    const point = tradeDate 
      ? data.find(d => d.date === tradeDate) || data[data.length - 1]
      : data[data.length - 1];

    if (!point) return null;

    const rsiVal = point.rsi;
    const emaVal = point.ema;
    const priceVal = trade.price || point.price;
    const risk = trade.analysis?.riskScore || 0;

    // 3. Generate RSI Descriptions
    let rsiText = "neutral momentum";
    if (rsiVal > 70) rsiText = "overbought conditions";
    else if (rsiVal < 30) rsiText = "oversold conditions";

    // 4. Generate EMA Description
    let emaText = "hovering near trend";
    if (priceVal > emaVal * 1.01) emaText = "above the 20-day trend line (bullish zone)";
    else if (priceVal < emaVal * 0.99) emaText = "below the 20-day trend line (bearish zone)";

    // 5. Final Synthesis
    const typeLabel = trade.type === "BUY" ? "bought" : "sold";
    
    return {
      text: `Market Context: You ${typeLabel} when the asset was in ${rsiText} (RSI: ${rsiVal?.toFixed(1) || 'N/A'}) and the execution price was ${emaText}.`,
      contextColor: risk > 70 ? "text-rose-600" : "text-emerald-600",
      rsi: rsiVal,
      ema: emaVal
    };
  }, [rawPrices, trade]);

  if (isLoading) return (
    <div className="mt-4 p-4 bg-slate-50 border border-slate-100 rounded-xl animate-pulse">
      <div className="h-3 w-32 bg-slate-200 rounded mb-2" />
      <div className="h-4 w-full bg-slate-200 rounded" />
    </div>
  );

  if (!insight) return null;

  return (
    <div className="mt-4 bg-blue-50/50 border border-blue-100/50 rounded-2xl p-5 relative group overflow-hidden">
      {/* Background Decor */}
      <div className="absolute -right-4 -bottom-4 opacity-10 text-blue-600 group-hover:scale-110 transition-transform duration-500">
        <Gauge size={120} strokeWidth={1} />
      </div>

      <div className="flex items-start gap-4">
        <div className="p-2 bg-blue-600 text-white rounded-lg shadow-lg shadow-blue-500/20">
          <Info size={16} />
        </div>
        <div>
          <h4 className="text-[10px] font-black text-blue-600 uppercase tracking-widest mb-1.5 flex items-center gap-1.5">
            Technical Insight Layer
          </h4>
          <p className="text-[13px] font-medium text-slate-700 leading-relaxed max-w-[240px]">
            {insight.text}
          </p>
        </div>
      </div>
    </div>
  );
}
