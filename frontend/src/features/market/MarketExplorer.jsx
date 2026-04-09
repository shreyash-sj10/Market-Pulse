import { motion, AnimatePresence } from "framer-motion";
import StockCard from "./components/StockCard.jsx";
import {
  Layers, Activity, TrendingUp, Search,
  X, BarChart, TrendingDown, ChevronDown,
  Navigation
} from "lucide-react";
import { useState, useMemo, useEffect } from "react";
import { getExplorerData } from "../../services/market.api.js";
import { getPositions } from "../../services/portfolio.api.js";
import PriceChart from "../trades/components/PriceChart.jsx";
import StockNews from "../../components/market/StockNews.jsx";
import { useQuery } from "@tanstack/react-query";

// ─── Pro Modal Component ───────────────────────────────────────────────────
const ProModal = ({ stock, onClose }) => {
  const symbol = stock.symbol;

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
              <PriceChart symbol={stock.symbol} />
            </div>

            <div className="lg:col-span-4 space-y-6 flex flex-col">
              <div className="p-8 bg-slate-50 border border-slate-200 rounded-2xl relative overflow-hidden">
                <div className="relative z-10">
                  <span className="text-[9px] font-bold uppercase tracking-widest text-slate-400 mb-2 block">System Pulse</span>
                  <p className="text-lg font-bold tracking-tight mb-2 text-slate-900">Metric Dashboard</p>
                  <div className="space-y-3 mt-4">
                      {stock.peRatio && (
                        <div className="flex justify-between py-2 border-b border-slate-200">
                           <span className="text-[10px] font-bold text-slate-400 uppercase">P/E Ratio</span>
                           <span className="text-sm font-bold text-slate-900">{stock.peRatio}</span>
                        </div>
                      )}
                      {stock.marketCap && (
                        <div className="flex justify-between py-2 border-b border-slate-200">
                           <span className="text-[10px] font-bold text-slate-400 uppercase">Market Cap</span>
                           <span className="text-sm font-bold text-slate-900">{(stock.marketCap / 1e12).toFixed(2)}T</span>
                        </div>
                      )}
                      <div className="flex justify-between py-2">
                         <span className="text-[10px] font-bold text-slate-400 uppercase">Volume</span>
                         <span className="text-sm font-bold text-slate-900">{(stock.volume / 1e6).toFixed(1)}M</span>
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

const MarketExplorer = () => {
  // State
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selectedStock, setSelectedStock] = useState(null);
  const [allLoadedStocks, setAllLoadedStocks] = useState([]);
  const [offset, setOffset] = useState(0);

  // Debounce search to prevent API flooding
  useEffect(() => {
    const timeout = setTimeout(() => {
      setDebouncedSearch(searchQuery);
      setOffset(0);            // Reset pagination on new search
      setAllLoadedStocks([]);  // Clear buffer on new search
    }, 600);
    return () => clearTimeout(timeout);
  }, [searchQuery]);

  // Queries
  const { data: currentChunk, isLoading: marketLoading } = useQuery({
    queryKey: ["explorer", offset, debouncedSearch],
    queryFn: () => getExplorerData(16, offset, debouncedSearch),
    refetchInterval: 30000,
    keepPreviousData: true
  });

  // Sync loaded stocks
  useEffect(() => {
    if (currentChunk?.stocks) {
      setAllLoadedStocks(prev => {
        const seen = new Set(prev.map(s => s.symbol));
        const filtered = currentChunk.stocks.filter(s => !seen.has(s.symbol));
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

  const hasMore = offset < 480; 
  const visibleStocks = allLoadedStocks;

  const handleLoadMore = () => {
    setOffset(prev => prev + 16);
  };

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
              <h1 className="text-4xl font-black text-slate-900 tracking-tight mb-2">Market Discovery</h1>
              <p className="text-slate-500 font-medium text-lg leading-relaxed max-w-2xl">
                Analyzing curated <span className="text-indigo-600 font-bold">liquid assets</span> across the NSE with real-time protocol verification.
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
            placeholder="Search by ticker symbol..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-16 pr-8 py-5 bg-white border border-slate-200 rounded-2xl shadow-sm focus:ring-4 focus:ring-indigo-600/5 focus:border-indigo-600 outline-none font-bold text-lg text-slate-900 transition-all placeholder:text-slate-300"
          />
      </div>

      {marketLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="h-[400px] rounded-3xl bg-white border border-slate-100 animate-pulse" />
          ))}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
            <AnimatePresence mode="popLayout">
              {visibleStocks.map((stock) => (
                <motion.div
                  key={stock.symbol}
                  layout
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.3 }}
                >
                  <StockCard 
                    stock={stock} 
                    isOwned={ownedSymbols.has(`${stock.symbol}.NS`)}
                    onOpenChart={() => setSelectedStock(stock)}
                  />
                </motion.div>
              ))}
            </AnimatePresence>
          </div>

          <div className="mt-16 flex flex-col items-center">
            {visibleStocks.length === 0 ? (
              <div className="text-center py-20 bg-white rounded-[3rem] border border-slate-100 shadow-sm w-full max-w-2xl px-8 flex flex-col items-center">
                <div className="p-6 bg-slate-50 rounded-2xl mb-6 border border-slate-100">
                  <Search size={32} className="text-slate-300" />
                </div>
                <h3 className="text-2xl font-black text-slate-900 tracking-tight">No Tickers Identified</h3>
                <p className="text-slate-400 text-xs font-bold uppercase tracking-[0.2em] mt-3">Try checking for typos or searching by full symbol.</p>
                <button 
                  onClick={() => setSearchQuery("")}
                  className="mt-8 px-8 py-3 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-600/20"
                >
                  Clear Filters
                </button>
              </div>
            ) : hasMore ? (
              <button
                onClick={handleLoadMore}
                className="flex items-center gap-3 py-4 px-10 bg-slate-900 hover:bg-black text-white rounded-2xl font-bold text-[10px] uppercase tracking-widest transition-all shadow-xl shadow-slate-900/20"
              >
                Reveal more assets <ChevronDown size={14} />
              </button>
            ) : null}
          </div>
        </>
      )}
    </div>
  );
};

export default MarketExplorer;
