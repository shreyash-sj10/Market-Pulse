import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { getHistoricalPrices } from "../../../services/market.api";
import { calculateEMA } from "../../../utils/chartHelpers";
import { calculateRSI } from "../utils/indicators";
import { Info, Gauge, Zap, Target, AlertTriangle, CheckCircle2, TrendingUp, Sparkles } from "lucide-react";
import { formatINR } from "../../../utils/currency.utils";

export default function TradeInsight({ symbol, trade }) {
  const { data: rawPrices, isLoading } = useQuery({
    queryKey: ["price-history", symbol],
    queryFn: () => getHistoricalPrices(symbol.toUpperCase()),
    enabled: !!symbol,
    staleTime: 1000 * 60 * 5,
  });

  const insight = useMemo(() => {
    if (!rawPrices?.data || rawPrices.data.length === 0 || !trade) return null;

    // 1. Calculate Indicators
    let data = calculateEMA(rawPrices.data, 20);
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
    const priceVal = trade.pricePaise || point.price;
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

  const strategyMatch = trade.analysis?.strategyMatch;
  const missed = trade.missedOpportunity;

  return (
    <div className="space-y-4">
      {/* Strategy Audit Panel */}
      <div className="bg-slate-900 rounded-2xl p-6 border border-slate-800 shadow-xl relative overflow-hidden group">
        <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-all">
          <Target size={100} />
        </div>
        <div className="relative z-10">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-indigo-600 rounded-lg text-white">
                <Zap size={14} />
              </div>
              <span className="text-[10px] font-black uppercase tracking-widest text-indigo-400">Strategy Integrity Audit</span>
            </div>
            {strategyMatch && (
              <div className={`px-2 py-1 rounded-md text-[9px] font-bold uppercase tracking-widest border ${strategyMatch.isValid ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border-rose-500/20'}`}>
                {strategyMatch.isValid ? 'Valid Setup' : 'Strategy Mismatch'}
              </div>
            )}
          </div>

          <div className="space-y-3">
            <div className="flex items-center gap-4">
              <div className="flex-grow pt-1">
                <span className="block text-[8px] font-bold text-slate-500 uppercase mb-1">Detected Intent</span>
                <p className="text-sm font-black text-white italic">"{trade.parsedIntent?.strategy || 'General'}"</p>
              </div>
              <div className="text-right">
                <span className="block text-[8px] font-bold text-slate-500 uppercase mb-1">Confidence</span>
                <p className="text-sm font-black text-indigo-400">{trade.parsedIntent?.confidence}%</p>
              </div>
            </div>

            {strategyMatch && !strategyMatch.isValid && (
              <div className="flex items-start gap-3 p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl">
                <AlertTriangle size={14} className="text-rose-500 mt-0.5 flex-shrink-0" />
                <p className="text-[11px] font-bold text-rose-400 leading-normal">{strategyMatch.mismatchReason}</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {missed && missed.maxPotentialProfit > 0 && (
        <div className="bg-emerald-500/5 rounded-2xl p-5 border border-emerald-500/10 relative overflow-hidden">
          <div className="flex items-center gap-3 mb-3">
            <Sparkles size={16} className="text-emerald-500" />
            <span className="text-[10px] font-black uppercase tracking-widest text-emerald-600">Opportunity Post-Mortem</span>
          </div>
          <p className="text-[12px] font-bold text-slate-800 leading-tight">
            Exit Efficiency: <span className="text-rose-600">Low</span>. Asset rallied another <span className="text-emerald-600">{missed.maxProfitPct}%</span> after your exit.
          </p>
          <p className="text-[10px] font-medium text-slate-500 mt-2 italic">
            * Identification of potential {formatINR(missed.maxPotentialProfit)} alpha left on table. Review hold-discipline protocols.
          </p>
        </div>
      )}

      {/* Legacy Technical Layer */}
      <div className="bg-blue-50/50 border border-blue-100/50 rounded-2xl p-5 relative group overflow-hidden">
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
    </div>
  );
}
