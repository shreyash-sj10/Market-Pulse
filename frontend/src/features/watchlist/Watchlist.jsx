import { useState, useEffect, useRef } from "react";
import { useQueries, useQuery } from "@tanstack/react-query";
import { getStockPrice, searchSymbols } from "../../services/market.api";
import { Plus, X, Star, Activity, Search, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import toast from "react-hot-toast";

export default function Watchlist() {
  const [symbols, setSymbols] = useState([]);
  const [newSymbol, setNewSymbol] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef(null);

  // 1. Initial Load from LocalStorage
  useEffect(() => {
    const saved = localStorage.getItem("watchlist");
    if (saved) {
      try {
        setSymbols(JSON.parse(saved));
      } catch (e) {
        setSymbols([]);
      }
    }

    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // 2. Search Query with Debounce Logic
  const { data: searchResults, isFetching: isSearching } = useQuery({
    queryKey: ["symbol-search", searchQuery],
    queryFn: () => searchSymbols(searchQuery),
    enabled: searchQuery.length > 0,
    staleTime: 1000 * 60 * 5, // 5 min cache
  });

  useEffect(() => {
    const timer = setTimeout(() => {
      setSearchQuery(newSymbol);
    }, 300);
    return () => clearTimeout(timer);
  }, [newSymbol]);

  // 3. Sync to LocalStorage
  const updateSymbols = (newSymbols) => {
    setSymbols(newSymbols);
    localStorage.setItem("watchlist", JSON.stringify(newSymbols));
  };

  const addSymbol = (sym) => {
    const cleanSym = sym.trim().toUpperCase();
    if (!cleanSym) return;
    
    if (symbols.includes(cleanSym)) {
      toast.error("Symbol already in watchlist");
      return;
    }
    
    if (symbols.length >= 5) {
      toast.error("Watchlist limit reached (max 5)");
      return;
    }

    updateSymbols([...symbols, cleanSym]);
    setNewSymbol("");
    setShowDropdown(false);
    toast.success(`Tracked ${cleanSym}`);
  };

  const removeSymbol = (sym) => {
    updateSymbols(symbols.filter((s) => s !== sym));
  };

  // 4. Parallel Price Queries
  const priceQueries = useQueries({
    queries: symbols.map((symbol) => ({
      queryKey: ["price", symbol],
      queryFn: async () => {
        const price = await getStockPrice(symbol);
        return { symbol, price };
      },
      refetchInterval: 60000, 
    })),
  });

  return (
    <div className="mt-auto pt-6 border-t border-slate-800 flex flex-col gap-4">
      <div className="px-4 flex items-center justify-between">
        <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
          <Star size={12} className="text-amber-400" /> My Watchlist
        </h3>
        <span className="text-[10px] font-bold text-slate-600">{symbols.length}/5</span>
      </div>

      {/* Symbol List */}
      <div className="px-2 flex flex-col gap-1.5 min-h-[100px]">
        {symbols.map((symbol, index) => {
          const query = priceQueries[index];
          const price = query?.data?.price;
          const isLoading = query?.isLoading;

          return (
            <motion.div 
              layout
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              key={symbol} 
              className="group flex items-center justify-between p-3 bg-slate-800/40 border border-slate-800/60 rounded-xl hover:bg-slate-800 transition-all duration-300"
            >
              <div className="flex flex-col">
                <span className="text-xs font-black text-slate-100">{symbol}</span>
                <div className="flex items-center gap-1.5 opacity-60">
                  <Activity size={10} className="text-blue-500" />
                  <span className="text-[10px] font-bold text-slate-500 uppercase">Live</span>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="text-right">
                  <p className="text-xs font-black text-white">
                    {isLoading ? (
                      <div className="h-3 w-8 bg-slate-700 animate-pulse rounded" />
                    ) : price ? `$${price.toFixed(2)}` : "—"}
                  </p>
                </div>
                <button 
                  onClick={() => removeSymbol(symbol)}
                  className="opacity-0 group-hover:opacity-100 p-1 text-slate-500 hover:text-rose-500 transition-all hover:scale-110"
                >
                  <X size={14} />
                </button>
              </div>
            </motion.div>
          );
        })}

        {symbols.length === 0 && (
          <div className="p-8 text-center border-2 border-dashed border-slate-800/40 rounded-2xl">
            <p className="text-[10px] font-bold text-slate-600 italic uppercase tracking-wider">No active trackers</p>
          </div>
        )}
      </div>

      {/* Add Form with Autocomplete */}
      {symbols.length < 5 && (
        <div className="px-2 pb-6 relative" ref={dropdownRef}>
          <div className="relative group">
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-blue-500 transition-colors">
              {isSearching ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
            </div>
            <input
              type="text"
              placeholder="Search ticker..."
              value={newSymbol}
              onFocus={() => setShowDropdown(true)}
              onChange={(e) => setNewSymbol(e.target.value)}
              className="w-full bg-slate-900 border border-slate-800 focus:border-blue-600 rounded-xl py-3 pl-10 pr-4 text-[11px] font-bold text-slate-200 outline-none transition-all placeholder:text-slate-600 shadow-inner"
            />
          </div>

          <AnimatePresence>
            {showDropdown && (searchResults?.length > 0 || isSearching) && (
              <motion.div
                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                animate={{ opacity: 1, y: -4, scale: 1 }}
                exit={{ opacity: 0, y: 10, scale: 0.95 }}
                className="absolute bottom-full left-2 right-2 mb-2 bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden z-50 backdrop-blur-xl"
              >
                <div className="max-h-60 overflow-y-auto py-2">
                  {searchResults?.map((res) => (
                    <button
                      key={res.symbol}
                      onClick={() => addSymbol(res.symbol)}
                      className="w-full px-4 py-2.5 flex items-center justify-between hover:bg-slate-800 text-left transition-colors group"
                    >
                      <div className="flex flex-col">
                        <span className="text-xs font-black text-slate-100 group-hover:text-blue-400 transition-colors">{res.symbol}</span>
                        <span className="text-[9px] font-medium text-slate-500 truncate w-32 tracking-tight">{res.description}</span>
                      </div>
                      <Plus size={12} className="text-slate-600 group-hover:text-blue-400" />
                    </button>
                  ))}
                  {isSearching && searchResults?.length === 0 && (
                    <div className="px-4 py-3 text-[10px] font-bold text-slate-600 uppercase tracking-widest text-center">Searching...</div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
