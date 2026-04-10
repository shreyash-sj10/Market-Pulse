import { motion, AnimatePresence } from "framer-motion";
import StockCard from "./components/StockCard.jsx";
import {
  Layers, Activity, TrendingUp, Search,
  X, BarChart, TrendingDown, ChevronDown,
  Navigation, AlertTriangle, Disc
} from "lucide-react";
import { useState, useMemo, useEffect } from "react";
import { useInView } from "react-intersection-observer";
import { getExplorerData } from "../../services/market.api.js";
import { getPositions } from "../../services/portfolio.api.js";
import PriceChart from "../trades/components/PriceChart.jsx";
import StockNews from "../../components/market/StockNews.jsx";
import { useQuery } from "@tanstack/react-query";
import { formatINR } from "../../utils/currency.utils";

// ─── Pro Modal Component ───────────────────────────────────────────────────
const ProModal = ({ stock, onClose }) => {
  const symbol = stock.symbol;
  const [activePoint, setActivePoint] = useState(null);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[100] flex items-center justify-center p-4 md:p-6"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="bg-white rounded-[1.5rem] shadow-2xl w-full max-w-6xl overflow-hidden max-h-[90vh] flex flex-col border border-slate-200"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-8 py-6 border-b border-slate-100 flex items-center justify-between bg-white text-slate-900">
          <div className="flex items-center gap-5">
            <div className="p-3 bg-slate-100 rounded-xl text-slate-900">
              <BarChart size={24} />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-0.5">
                <h2 className="text-2xl font-bold tracking-tight">{symbol}</h2>
                <div className="px-2 py-0.5 bg-indigo-600 text-white text-[8px] font-bold rounded uppercase tracking-wider">Analysis Active</div>
              </div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none">Market Snapshot</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2.5 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <X size={20} className="text-slate-400" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-grow overflow-y-auto p-8 custom-scrollbar">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            <div className="lg:col-span-8 h-[550px] rounded-2xl overflow-hidden border border-slate-100 bg-slate-50 relative">
              <PriceChart symbol={stock.symbol} onHover={setActivePoint} />
            </div>

            <div className="lg:col-span-4 space-y-6 flex flex-col">
              <div className="p-8 bg-slate-50 border border-slate-200 rounded-2xl relative overflow-hidden">
                <div className="relative z-10">
                  <span className="text-[9px] font-bold uppercase tracking-widest text-slate-400 mb-2 block">System Pulse</span>
                  <p className="text-lg font-bold tracking-tight mb-2 text-slate-900">Metric Dashboard</p>
                  <div className="space-y-3 mt-4">
                    <div className="flex justify-between py-2 border-b border-slate-200">
                      <span className="text-[10px] font-bold text-slate-400 uppercase">{activePoint ? 'Historical Price' : 'Last Traded Price'}</span>
                      <span className="text-sm font-black text-indigo-600">{formatINR(activePoint ? activePoint.close : stock.price)}</span>
                    </div>

                    <div className="flex justify-between py-2 border-b border-slate-200">
                      <span className="text-[10px] font-bold text-slate-400 uppercase">Analysis RSI</span>
                      <span className={`text-sm font-black ${activePoint?.rsi > 70 ? 'text-rose-500' : activePoint?.rsi < 30 ? 'text-emerald-500' : 'text-slate-900'}`}>
                        {activePoint ? activePoint.rsi.toFixed(1) : 'Live Compute'}
                      </span>
                    </div>

                    <div className="flex justify-between py-2 border-b border-slate-200">
                      <span className="text-[10px] font-bold text-slate-400 uppercase">Pulse Volume</span>
                      <span className="text-sm font-bold text-slate-900">
                        {activePoint 
                          ? (activePoint.volume / 1000).toFixed(1) + 'K' 
                          : (stock.volume / 1e6).toFixed(1) + 'M'}
                      </span>
                    </div>

                    <div className="flex justify-between py-2">
                       <span className="text-[10px] font-bold text-slate-400 uppercase">Session Date</span>
                       <span className="text-xs font-bold text-slate-500 italic">
                         {activePoint ? activePoint.time : 'Real-time Feeds'}
                       </span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex-grow flex flex-col min-h-[300px]">
                <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-4 px-1">Institutional Flow</h3>
                <div className="flex-grow rounded-2xl border border-slate-100 overflow-hidden bg-white overflow-y-auto custom-scrollbar">
                  <StockNews symbol={`NSE:${symbol}`} />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-8 py-5 bg-slate-50 flex items-center justify-between border-t border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />
            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Feed Fidelity: High</span>
          </div>
          <button
            onClick={onClose}
            className="px-8 py-3 bg-slate-900 hover:bg-black text-white font-bold text-[10px] uppercase tracking-widest rounded-lg transition-all"
          >
            Close Analyst View
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
};

// ─── Market Explorer Component ─────────────────────────────────────────────
const MarketExplorer = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selectedStock, setSelectedStock] = useState(null);
  const [allLoadedStocks, setAllLoadedStocks] = useState([]);
  const [offset, setOffset] = useState(0);

  const { ref: loadMoreRef, inView } = useInView({
    threshold: 0.5,
    triggerOnce: false
  });

  // Debounce search
  useEffect(() => {
    const timeout = setTimeout(() => {
      setDebouncedSearch(searchQuery);
      setOffset(0);
      setAllLoadedStocks([]);
    }, 500);
    return () => clearTimeout(timeout);
  }, [searchQuery]);

  // Infinite Scroll Trigger
  useEffect(() => {
    if (inView && !marketLoading && hasMore) {
       setOffset(prev => prev + 20);
    }
  }, [inView]);

  // Data Fetching
  const { data: currentChunk, isLoading: marketLoading, isError, refetch } = useQuery({
    queryKey: ["explorer", offset, debouncedSearch],
    queryFn: () => getExplorerData(20, offset, debouncedSearch),
    staleTime: 30000,
    keepPreviousData: true,
    retry: 1
  });

  // Sync state
  useEffect(() => {
    if (currentChunk?.stocks) {
      setAllLoadedStocks(prev => {
        const incoming = currentChunk.stocks;
        const seen = new Set(prev.map(s => s.symbol));
        const filtered = incoming.filter(s => !seen.has(s.symbol));
        return [...prev, ...filtered];
      });
    }
  }, [currentChunk]);

  const { data: posResponse } = useQuery({
    queryKey: ["positions"],
    queryFn: getPositions
  });

  const ownedSymbols = useMemo(() => {
    return new Set(posResponse?.positions?.map(p => p.fullSymbol) || []);
  }, [posResponse]);

  const hasMore = allLoadedStocks.length < 150 && !searchQuery;

  if (isError) return (
    <div className="max-w-[1500px] mx-auto min-h-[60vh] flex items-center justify-center p-4">
      <div className="text-center p-12 bg-white rounded-[3rem] border border-rose-100 shadow-xl max-w-xl w-full">
         <div className="w-16 h-16 bg-rose-50 rounded-2xl flex items-center justify-center mx-auto mb-6 text-rose-500">
            <AlertTriangle size={32} />
         </div>
         <h2 className="text-3xl font-black text-slate-900 tracking-tight mb-3">Market Feed Disrupted</h2>
         <p className="text-slate-500 font-medium mb-8">Our connection to the NSE terminal has been momentarily severed. The system is attempting automatic re-interpolation.</p>
         <button 
           onClick={() => refetch()}
           className="w-full py-4 bg-indigo-600 hover:bg-black text-white rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all shadow-lg shadow-indigo-600/20"
         >
           Force Manual Recalibration
         </button>
      </div>
    </div>
  );

  return (
    <div className="max-w-[1500px] mx-auto pb-20 px-4 mt-8">
      <AnimatePresence>
        {selectedStock && (
          <ProModal
            stock={selectedStock}
            onClose={() => setSelectedStock(null)}
          />
        )}
      </AnimatePresence>

      <div className="mb-12 flex flex-col lg:flex-row lg:items-end justify-between gap-6">
        <div className="border-l-2 border-indigo-600 pl-8">
          <h1 className="text-4xl font-black text-slate-900 tracking-tight mb-2">Discovery Hub</h1>
          <p className="text-slate-500 font-medium text-lg leading-relaxed max-w-2xl">
            Analyzing <span className="text-indigo-600 font-bold">NIFTY 500</span> liquidity pool with real-time O(1) protocol verification.
          </p>
        </div>
        <div className="flex items-center gap-3 px-6 py-4 bg-white border border-slate-100 rounded-3xl shadow-sm">
          <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg">
            <Activity size={16} />
          </div>
          <div>
            <span className="block text-[8px] font-bold text-slate-400 uppercase tracking-widest leading-none mb-1">Exchange Status</span>
            <span className="block text-xs font-bold text-slate-900 uppercase">Live Feed Active</span>
          </div>
        </div>
      </div>

      <div className="mb-10 group relative max-w-3xl">
        <div className="absolute inset-y-0 left-6 flex items-center pointer-events-none text-slate-300 group-focus-within:text-indigo-600 transition-colors">
          <Search size={22} />
        </div>
        <input
          type="text"
          placeholder="Search 500+ Nifty tickers..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-16 pr-8 py-5 bg-white border border-slate-200 rounded-2xl shadow-sm focus:ring-4 focus:ring-indigo-600/5 focus:border-indigo-600 outline-none font-bold text-lg text-slate-900 transition-all placeholder:text-slate-300"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
        {allLoadedStocks.map((stock) => (
          <motion.div
            key={stock.symbol}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
          >
            <StockCard
              stock={stock}
              isOwned={ownedSymbols.has(`${stock.symbol}.NS`)}
              onOpenChart={() => setSelectedStock(stock)}
            />
          </motion.div>
        ))}
        
        {/* Loading Skeletons */}
        {marketLoading && [...Array(4)].map((_, i) => (
          <div key={`loader-${i}`} className="h-[440px] bg-slate-50 border border-slate-100 rounded-[2.5rem] animate-pulse flex flex-col p-10">
             <div className="w-1/2 h-8 bg-slate-200 rounded-lg mb-4" />
             <div className="w-1/3 h-4 bg-slate-100 rounded-lg mb-auto" />
             <div className="w-full h-12 bg-slate-200 rounded-xl" />
          </div>
        ))}
      </div>

      {/* Persistence Point for Infinite Scroll */}
      <div ref={loadMoreRef} className="h-20 mt-10 flex items-center justify-center">
        {hasMore && !marketLoading && (
          <div className="flex items-center gap-3 text-slate-300">
             <Disc size={20} className="animate-spin" />
             <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Loading next tier...</span>
          </div>
        )}
      </div>

      {allLoadedStocks.length === 0 && !marketLoading && (
        <div className="text-center py-20 bg-white rounded-[3rem] border border-slate-100 shadow-sm w-full max-w-2xl mx-auto px-8 flex flex-col items-center">
          <div className="p-6 bg-slate-50 rounded-2xl mb-6 border border-slate-100">
            <Search size={32} className="text-slate-300" />
          </div>
          <h3 className="text-2xl font-black text-slate-900 tracking-tight">No Tickers Identified</h3>
          <button
            onClick={() => setSearchQuery("")}
            className="mt-8 px-8 py-3 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-700 transition-all"
          >
            Clear Filters
          </button>
        </div>
      )}
    </div>
  );
};

export default MarketExplorer;
