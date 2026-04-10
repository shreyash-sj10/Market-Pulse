import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ComposedChart,
  Line,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Cell,
} from "recharts";
import { getHistoricalPrices } from "../../../services/market.api.js";
import { calculateEMA } from "../../../utils/chartHelpers.js";
import { calculateRSI, calculateVolumeColors } from "../utils/indicators.js";
import { formatINR } from "../../../utils/currency.utils.js";

// ─── Candlestick Component ──────────────────────────────────────────────────
const Candle = (props) => {
  const { x, y, width, height, low, high, open, close } = props;
  const isUp = close >= open;
  const color = isUp ? "#10b981" : "#f43f5e";
  
  // Center wick
  const wickX = x + width / 2;
  
  return (
    <g>
      {/* Wick (High to Low) */}
      <line 
        x1={wickX} y1={y} x2={wickX} y2={y + height} 
        stroke={color} strokeWidth={1} 
      />
      {/* Body */}
      <rect 
        x={x} y={isUp ? close : open} 
        width={width} height={Math.max(1, Math.abs(open - close))} 
        fill={color} 
      />
    </g>
  );
};

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    const d = payload[0].payload;
    return (
      <div className="bg-slate-900 border border-slate-700 p-4 rounded-xl shadow-2xl min-w-[180px] backdrop-blur-md bg-opacity-90">
        <p className="text-slate-400 text-[9px] uppercase font-black tracking-widest mb-2 border-b border-slate-800 pb-2">{d.time}</p>
        <div className="space-y-1.5">
          <div className="flex justify-between gap-4">
               <span className="text-[9px] font-bold text-slate-500 uppercase">Open</span>
               <span className="text-xs font-bold text-white">{formatINR(d.open)}</span>
          </div>
          <div className="flex justify-between gap-4">
               <span className="text-[9px] font-bold text-slate-500 uppercase">High</span>
               <span className="text-xs font-bold text-emerald-400">{formatINR(d.high)}</span>
          </div>
          <div className="flex justify-between gap-4">
               <span className="text-[9px] font-bold text-slate-500 uppercase">Low</span>
               <span className="text-xs font-bold text-rose-400">{formatINR(d.low)}</span>
          </div>
          <div className="flex justify-between gap-4 font-bold">
               <span className="text-[9px] font-bold text-slate-500 uppercase">Close</span>
               <span className="text-xs font-bold text-white">{formatINR(d.close)}</span>
          </div>
          <div className="mt-2 pt-2 border-t border-slate-800 flex justify-between gap-4">
               <span className="text-[9px] font-bold text-slate-500 uppercase">EMA (20)</span>
               <span className="text-xs font-bold text-orange-400">{formatINR(d.ema)}</span>
          </div>
          {d.rsi && (
            <div className="flex justify-between gap-4">
                 <span className="text-[9px] font-bold text-slate-500 uppercase">RSI (14)</span>
                 <span className="text-xs font-bold text-indigo-400">{d.rsi.toFixed(2)}</span>
            </div>
          )}
        </div>
      </div>
    );
  }
  return null;
};

export default function PriceChart({ symbol, livePrice, onHover }) {
  const [activeTimeframe, setActiveTimeframe] = useState("1M");
  const [hoveredPoint, setHoveredPoint] = useState(null);

  const { data: rawPrices, isLoading, error } = useQuery({
    queryKey: ["price-history-strict", symbol, activeTimeframe],
    queryFn: () => getHistoricalPrices(symbol.toUpperCase(), activeTimeframe),
    enabled: !!symbol,
    staleTime: 1000 * 60 * 5,
  });

  const chartData = useMemo(() => {
    const prices = rawPrices?.data || [];
    if (!prices.length) return [];
    
    let data = calculateEMA(prices, 20);
    data = calculateRSI(data, 14);
    data = calculateVolumeColors(data);
    
    return data;
  }, [rawPrices]);

  const latestPoint = chartData[chartData.length - 1];

  const handleMouseMove = (e) => {
    if (e.activePayload) {
      const point = e.activePayload[0].payload;
      setHoveredPoint(point);
      if (onHover) onHover(point);
    }
  };

  const handleMouseLeave = () => {
    setHoveredPoint(null);
    if (onHover) onHover(null);
  };

  if (isLoading) return <div className="h-full w-full flex items-center justify-center bg-slate-50/50 rounded-2xl animate-pulse text-slate-400 font-bold text-[10px] uppercase">Initializing Engine...</div>;
  if (error || !chartData.length) return <div className="h-full w-full flex items-center justify-center text-slate-400 text-xs">No Market Data Available</div>;

  return (
    <div className="h-full w-full bg-white flex flex-col p-6 gap-4">
      {/* Institutional Header */}
      <div className="flex justify-between items-start mb-4">
        <div>
          <h2 className="text-3xl font-black text-slate-900 tracking-tighter uppercase">{symbol.replace(".NS", "")}</h2>
          {latestPoint && latestPoint.close !== undefined && (
            <div className="flex items-center gap-3 mt-1 px-1">
               <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                 Trend: <span className={latestPoint.close > latestPoint.ema ? 'text-emerald-500' : 'text-rose-500'}>
                   {latestPoint.close > latestPoint.ema ? 'Bullish' : 'Bearish'}
                 </span>
               </span>
               <span className="w-1 h-1 rounded-full bg-slate-200" />
               <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                 RSI Intensity: <span className={latestPoint.rsi > 70 ? 'text-rose-500' : latestPoint.rsi < 30 ? 'text-emerald-500' : 'text-indigo-600'}>
                   {latestPoint.rsi > 70 ? 'Extreme' : latestPoint.rsi < 30 ? 'Depressed' : 'Neutral'}
                 </span>
               </span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2 p-1 bg-slate-50 border border-slate-100 rounded-xl">
          {["1D", "1W", "1M", "3M", "1Y"].map(tf => (
            <button
              key={tf}
              onClick={() => setActiveTimeframe(tf)}
              className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${activeTimeframe === tf ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-400 hover:text-slate-600'}`}
            >
              {tf}
            </button>
          ))}
        </div>
      </div>

      {/* Main Viewport (Candlestick + EMA) */}
      <div className="flex-grow flex flex-col gap-2 min-h-0">
        {/* Price Pane (65%) */}
        <div className="h-[65%] w-full relative">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart 
              data={chartData} 
              syncId="strictChart" 
              margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
              onMouseMove={handleMouseMove}
              onMouseLeave={handleMouseLeave}
            >
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis dataKey="time" hide />
              <YAxis 
                domain={['auto', 'auto']} 
                orientation="right" 
                stroke="#94a3b8" 
                fontSize={9} 
                tickLine={false} 
                axisLine={false}
                tickFormatter={(v) => formatINR(v)}
              />
              <Tooltip content={<CustomTooltip />} />
              
              {/* High-Contrast Candlesticks */}
              <Bar 
                 dataKey={(d) => [d.low, d.high]} 
                 fill="#e2e8f0" 
                 barSize={1}
                 isAnimationActive={false}
              />
              <Bar 
                dataKey={(d) => [Math.min(d.open, d.close), Math.max(d.open, d.close)]}
                isAnimationActive={false}
                barSize={8}
              >
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.close >= entry.open ? "#10b981" : "#f43f5e"} />
                ))}
              </Bar>


              <Line 
                type="monotone" 
                dataKey="ema" 
                stroke="#6366f1" 
                strokeWidth={1} 
                dot={false} 
                isAnimationActive={false} 
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        {/* Volume Pane (10%) */}
        <div className="h-[10%] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData} syncId="strictChart" margin={{ top: 0, right: 30, left: 0, bottom: 0 }}>
              <XAxis dataKey="time" hide />
              <YAxis hide />
              <Bar dataKey="volume">
                {chartData.map((entry, index) => (
                  <Cell key={`vol-${index}`} fill={entry.volumeColor} opacity={0.4} />
                ))}
              </Bar>
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        {/* RSI Pane (25%) */}
        <div className="h-[25%] w-full border-t border-slate-100 pt-2">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData} syncId="strictChart" margin={{ top: 5, right: 30, left: 0, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis 
                dataKey="time" 
                stroke="#94a3b8" 
                fontSize={9} 
                tickLine={false} 
                axisLine={false} 
                minTickGap={40}
                tickFormatter={(t) => t} 
              />
              <YAxis domain={[0, 100]} ticks={[30, 70]} orientation="right" stroke="#94a3b8" fontSize={9} tickLine={false} axisLine={false} />
              
              <ReferenceLine y={70} stroke="#fca5a5" strokeDasharray="5 5" />
              <ReferenceLine y={30} stroke="#86efac" strokeDasharray="5 5" />
              <ReferenceLine y={50} stroke="#e2e8f0" strokeDasharray="3 3" />
              
              <Line 
                type="monotone" 
                dataKey="rsi" 
                stroke="#6366f1" 
                strokeWidth={1.5} 
                dot={false} 
                isAnimationActive={false} 
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
