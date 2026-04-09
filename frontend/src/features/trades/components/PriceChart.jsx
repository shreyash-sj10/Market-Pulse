import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Cell,
  Scatter,
} from "recharts";
import { getHistoricalPrices } from "../../../services/market.api.js";
import { getTrades } from "../../../services/trade.api.js";
import { calculateEMA } from "../../../utils/chartHelpers.js";
import { calculateRSI, calculateVolumeColors, getRiskColor } from "../utils/indicators.js";
import { mapTradesToChartData } from "../utils/tradeMapping.js";

const CustomTooltip = ({ active, payload, label, title }) => {
  if (active && payload && payload.length) {
    const mainData = payload[0].payload;
    const hasTrade = mainData.tradeBuy || mainData.tradeSell;

    return (
      <div className="bg-slate-900 border border-slate-700 p-3 rounded-lg shadow-xl min-w-[140px]">
        <p className="text-slate-400 text-[10px] uppercase font-black mb-1">{title || 'Data'}</p>
        <p className="text-slate-200 text-xs font-bold mb-2">{label}</p>
        
        <div className="flex flex-col gap-1.5 mb-2">
          {payload.filter(p => p.dataKey !== 'tradeBuy' && p.dataKey !== 'tradeSell').map((p, i) => (
            <div key={i} className="flex items-center justify-between gap-4">
              <span className="text-[10px] uppercase font-black" style={{ color: p.color }}>{p.name}</span>
              <span className="text-white text-xs font-bold">
                {typeof p.value === 'number' ? (p.value > 1000 ? p.value.toLocaleString() : p.value.toFixed(2)) : p.value}
              </span>
            </div>
          ))}
        </div>

        {/* Trade Execution Context */}
        {hasTrade && (
          <div className="mt-3 pt-2 border-t border-slate-800">
            <p className="text-[9px] text-slate-500 font-black uppercase mb-1.5 tracking-tighter">System Analysis</p>
            {mainData.tradeBuy && (
              <div className="flex flex-col gap-1">
                <div className="flex justify-between items-center bg-emerald-500/10 px-2 py-1 rounded border border-emerald-500/20">
                  <span className="text-[10px] font-black text-emerald-400">BUY</span>
                  <span className="text-white text-xs font-bold">₹{mainData.tradeBuy.price.toFixed(2)}</span>
                </div>
                <div className="text-[9px] font-bold px-1.5 py-0.5 rounded flex justify-between" style={{ color: mainData.tradeBuy.riskColor }}>
                  <span>RISK FACTOR</span>
                  <span>{mainData.tradeBuy.riskScore}/100</span>
                </div>
              </div>
            )}
            {mainData.tradeSell && (
              <div className="flex flex-col gap-1">
                <div className="flex justify-between items-center bg-rose-500/10 px-2 py-1 rounded border border-rose-500/20">
                  <span className="text-[10px] font-black text-rose-400">SELL</span>
                  <span className="text-white text-xs font-bold">₹{mainData.tradeSell.price.toFixed(2)}</span>
                </div>
                <div className="text-[9px] font-bold px-1.5 py-0.5 rounded flex justify-between" style={{ color: mainData.tradeSell.riskColor }}>
                  <span>RISK FACTOR</span>
                  <span>{mainData.tradeSell.riskScore}/100</span>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }
  return null;
};

export default function PriceChart({ symbol }) {
  const [activeTimeframe, setActiveTimeframe] = useState("1M");

  // Query 1: Prices
  const { data: rawPrices, isLoading: isPricesLoading, error: pricesError } = useQuery({
    queryKey: ["price-history", symbol, activeTimeframe],
    queryFn: () => getHistoricalPrices(symbol.toUpperCase(), activeTimeframe),
    enabled: !!symbol && symbol.length > 0,
    staleTime: 1000 * 60 * 5, 
  });

  // Query 2: User Trades
  const { data: rawTradesData, isLoading: isTradesLoading } = useQuery({
    queryKey: ["trades", symbol],
    queryFn: () => getTrades({ limit: 50 }), // Get recent history for mapping
    enabled: !!symbol && symbol.length > 0,
    staleTime: 1000 * 30, // 30 seconds stale
  });

  // Memoized indicator and trade mapping
  const chartData = useMemo(() => {
    const prices = rawPrices?.data || [];
    if (prices.length === 0) return [];
    
    // 1. Technical Indicators
    let data = calculateEMA(prices, 20);
    data = calculateRSI(data, 14);
    data = calculateVolumeColors(data);
    
    // 2. Map Trades onto chart coordinates
    const trades = rawTradesData?.trades || [];
    data = mapTradesToChartData(data, trades, symbol);
    
    return data;
  }, [rawPrices, rawTradesData, symbol]);

  if (!symbol) {
    return (
      <div className="h-full w-full flex items-center justify-center border-2 border-dashed border-slate-200 rounded-2xl bg-slate-50/30">
        <p className="text-slate-400 font-medium text-sm">Enter a symbol to visualize market trend</p>
      </div>
    );
  }

  if (isPricesLoading) {
    return (
      <div className="h-full w-full flex items-center justify-center border border-slate-100 rounded-2xl bg-white shadow-sm">
        <div className="flex flex-col items-center gap-3">
          <div className="h-6 w-6 border-2 border-slate-200 border-t-blue-500 rounded-full animate-spin" />
          <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest">Fetching Market Data...</p>
        </div>
      </div>
    );
  }

  if (pricesError || !chartData.length) {
    return (
      <div className="h-full w-full flex items-center justify-center border border-slate-100 rounded-2xl bg-white shadow-sm">
        <p className="text-slate-400 font-medium text-sm">
          {pricesError ? "Error loading market data" : `No historical data for ${symbol.toUpperCase()}`}
        </p>
      </div>
    );
  }

  return (
    <div className="h-full w-full bg-white border border-slate-100 rounded-2xl shadow-sm p-4 flex flex-col gap-2 overflow-hidden">
      
      {/* Header Info */}
      <div className="flex justify-between items-center mb-2 px-1">
        <div className="flex flex-col gap-1">
          <h3 className="font-black text-slate-800 text-lg flex items-center gap-2">
            {symbol.toUpperCase()} 
            <span className="text-[10px] font-black px-2 py-0.5 bg-blue-50 text-blue-600 rounded-full border border-blue-100 uppercase">
              {activeTimeframe} View
            </span>
          </h3>
        </div>

        {/* Timeframe Switcher */}
        <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200">
          {["1D", "1W", "1M"].map((tf) => (
            <button
              key={tf}
              onClick={() => setActiveTimeframe(tf)}
              className={`px-3 py-1 rounded-lg text-[10px] font-black transition-all ${
                activeTimeframe === tf 
                  ? "bg-white text-blue-600 shadow-sm border border-slate-200" 
                  : "text-slate-400 hover:text-slate-600"
              }`}
            >
              {tf}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-4 text-[9px] font-black tracking-wider uppercase text-slate-400">
          <span className="flex items-center gap-1.5"><div className="w-2 h-2 bg-emerald-500 rounded-full" /> Buy</span>
          <span className="flex items-center gap-1.5"><div className="w-2 h-2 bg-rose-500 rounded-full" /> Sell</span>
          <span className="flex items-center gap-1.5"><div className="w-2 h-2 border-2 border-orange-400 rounded-full" /> EMA</span>
        </div>
      </div>

      {/* CHART 1: Price + EMA + Trades (55% height) */}
      <div className="h-[55%] w-full relative">
        <div className="absolute top-2 left-8 z-10 text-[10px] font-black text-slate-400 uppercase tracking-widest pointer-events-none">Price / Execution</div>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} syncId="stockChartSync" margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
            <XAxis dataKey="date" hide />
            <YAxis 
              domain={['dataMin - (dataMin * 0.02)', 'dataMax + (dataMax * 0.02)']} 
              stroke="#94a3b8" 
              fontSize={9} 
              tickLine={false} 
              axisLine={false}
              tickFormatter={(val) => `₹${val.toFixed(0)}`}
            />
            <Tooltip content={<CustomTooltip title="Execution Context" />} />
            
            {/* Indicators */}
            <Line name="EMA" type="monotone" dataKey="ema" stroke="#fb923c" strokeWidth={1} strokeDasharray="5 5" dot={false} animationDuration={800} />
            <Line name="Price" type="monotone" dataKey="price" stroke="#3b82f6" strokeWidth={2.5} dot={false} activeDot={{ r: 4, fill: '#3b82f6', stroke: '#fff', strokeWidth: 2 }} animationDuration={600} />
            
            {/* Trade Markers (Scatter Overlays) */}
            <Scatter name="BUY" dataKey="buyPrice">
              {chartData.map((entry, index) => (
                <Cell key={`buy-${index}`} fill={entry.tradeBuy?.riskColor || "#10b981"} />
              ))}
            </Scatter>
            <Scatter name="SELL" dataKey="sellPrice">
              {chartData.map((entry, index) => (
                <Cell key={`sell-${index}`} fill={entry.tradeSell?.riskColor || "#f43f5e"} />
              ))}
            </Scatter>
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* CHART 2: Volume (15% height) */}
      <div className="h-[15%] w-full relative border-t border-slate-50 pt-1">
        <div className="absolute top-1 left-8 z-10 text-[10px] font-black text-slate-400 uppercase tracking-widest pointer-events-none">Volume</div>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} syncId="stockChartSync" margin={{ top: 0, right: 5, left: -20, bottom: 0 }}>
            <XAxis dataKey="date" hide />
            <YAxis hide />
            <Tooltip content={<CustomTooltip title="Market Volume" />} />
            <Bar name="Volume" dataKey="volume">
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.volumeColor} opacity={0.7} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* CHART 3: RSI (30% height) */}
      <div className="h-[30%] w-full relative border-t border-slate-50 pt-1">
        <div className="absolute top-1 left-8 z-10 text-[10px] font-black text-slate-400 uppercase tracking-widest pointer-events-none">RSI (14)</div>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} syncId="stockChartSync" margin={{ top: 10, right: 5, left: -20, bottom: 20 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
            <XAxis 
              dataKey="date" 
              stroke="#94a3b8" 
              fontSize={9} 
              tickLine={false} 
              axisLine={false} 
              minTickGap={30}
              tickFormatter={(str) => str}
            />
            <YAxis domain={[0, 100]} ticks={[30, 50, 70]} stroke="#94a3b8" fontSize={9} tickLine={false} axisLine={false} />
            <Tooltip content={<CustomTooltip title="Momentum / RSI" />} />
            <ReferenceLine y={70} stroke="#fca5a5" strokeDasharray="3 3" label={{ position: 'right', value: '70', fill: '#fca5a5', fontSize: 8 }} />
            <ReferenceLine y={30} stroke="#86efac" strokeDasharray="3 3" label={{ position: 'right', value: '30', fill: '#86efac', fontSize: 8 }} />
            <Line name="RSI" type="monotone" dataKey="rsi" stroke="#64748b" strokeWidth={2} dot={false} animationDuration={1000} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
