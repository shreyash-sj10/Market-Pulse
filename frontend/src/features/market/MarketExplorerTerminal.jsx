import { useState } from "react";
import { ErrorState } from "../../components/common/ExperienceStates";
import {
  Search,
  Activity,
  Filter,
  TrendingUp,
  TrendingDown,
  Globe,
  RefreshCw,
  X
} from "lucide-react";
import StockCard from "./components/StockCard";
import { useNavigate } from "react-router-dom";
import PriceChart from "../trades/components/PriceChart";
import { useMarketExplorer, useMarketHistory } from "../../hooks/useMarket";

const MarketExplorer = () => {
  const [activeTimeframe, setActiveTimeframe] = useState("1M");
  const navigate = useNavigate();
  const marketExplorer = useMarketExplorer();
  const { state, actions, data, query } = marketExplorer;
  const { search, filter, capFilter, displayLimit, chartSymbol } = state;
  const { filteredStocks, visibleStocks, explorerMeta } = data;
  const { isLoading, isFetching, isError } = query;
  const chartHistory = useMarketHistory(chartSymbol, activeTimeframe);

  if (isError) return <ErrorState onRetry={() => actions.refresh()} />;

  return (
    <div className="app-page px-2 pt-4">
      <div className="space-y-6">
        <div className="bg-white rounded-3xl border border-slate-200 p-8 shadow-sm">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-8">
            <div>
              <div className="flex items-center gap-3 mb-3">
                <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.45)]" />
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">Live Discovery Engine</span>
              </div>
              <h1 className="text-5xl lg:text-6xl font-black text-slate-900 tracking-tight uppercase italic">
                Market Explorer
              </h1>
              <p className="mt-2 text-sm font-semibold text-slate-500">
                Universe: Nifty 500+ Assets • Standardized Real-time Valuations
              </p>
            </div>

            <div className="flex flex-col gap-4 w-full md:w-auto">
              <div className="relative">
                <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search symbol..."
                  value={search}
                  onChange={(e) => actions.setSearch(e.target.value)}
                  className="w-full md:w-[360px] bg-slate-50 border border-slate-200 rounded-2xl py-3 pl-11 pr-4 text-sm font-semibold text-slate-900 outline-none focus:ring-4 focus:ring-indigo-100 focus:border-indigo-400 transition-all font-mono"
                />
              </div>

              <div className="flex flex-wrap items-center gap-3">
                {/* Performance Filter */}
                <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200">
                  {["ALL", "GAINERS", "LOSERS"].map((id) => (
                    <button
                      key={id}
                      onClick={() => actions.setFilter(id)}
                      className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all ${
                        filter === id ? "bg-white text-indigo-600 shadow-sm" : "text-slate-400 hover:text-slate-600"
                      }`}
                    >
                      {id === "ALL" ? <Globe size={12} className="inline mr-1" /> : id === "GAINERS" ? <TrendingUp size={12} className="inline mr-1 text-emerald-500" /> : <TrendingDown size={12} className="inline mr-1 text-rose-500" />}
                      {id}
                    </button>
                  ))}
                </div>

                {/* Market Cap Filter */}
                <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200">
                  {["ALL", "LARGE", "MID", "SMALL"].map((id) => (
                    <button
                      key={id}
                      onClick={() => actions.setCapFilter(id)}
                      className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all ${
                        capFilter === id 
                          ? id === "LARGE" ? "bg-indigo-600 text-white shadow-sm" : id === "MID" ? "bg-emerald-600 text-white shadow-sm" : id === "SMALL" ? "bg-amber-600 text-white shadow-sm" : "bg-white text-slate-900 shadow-sm"
                          : "text-slate-400 hover:text-slate-600"
                      }`}
                    >
                      {id} CAP
                    </button>
                  ))}
                </div>

                <button
                  onClick={() => actions.refresh()}
                  className="ml-auto px-3 py-2 rounded-xl border border-slate-200 text-slate-500 hover:text-slate-700 hover:border-slate-300 transition-colors bg-white shadow-sm"
                  title="Refresh universe prices"
                >
                  <RefreshCw size={14} className={isFetching ? "animate-spin" : ""} />
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
               <div className="p-2 bg-indigo-50 rounded-lg">
                 <Filter size={14} className="text-indigo-600" />
               </div>
               <span className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">
                  Listing {visibleStocks.length} of {filteredStocks.length} matching securities
               </span>
            </div>
            <div className="px-3 py-1 bg-slate-50 border border-slate-100 rounded-full text-[9px] font-bold uppercase tracking-widest text-slate-400">
              Universe: NIFTY 500+
            </div>
            {(explorerMeta.isSynthetic || explorerMeta.isFallback) && (
              <div className="px-3 py-1 bg-amber-50 border border-amber-100 rounded-full text-[9px] font-bold uppercase tracking-widest text-amber-700">
                {explorerMeta.isSynthetic ? "Synthetic Feed" : "Fallback Feed"}
              </div>
            )}
          </div>

          {isLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-6">
              {Array.from({ length: 12 }).map((_, i) => (
                <div key={i} className="h-[400px] rounded-[2rem] bg-slate-50 animate-pulse border border-slate-100" />
              ))}
            </div>
          ) : filteredStocks.length === 0 ? (
            <div className="h-[400px] flex flex-col items-center justify-center space-y-4">
              <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center">
                <Search size={32} className="text-slate-200" />
              </div>
              <div className="text-center">
                <p className="text-lg font-black uppercase tracking-widest text-slate-800">No matching assets</p>
                <p className="text-xs text-slate-400 mt-1 font-bold">Try adjusting filters or search term</p>
              </div>
            </div>
          ) : (
            <div className="max-h-[calc(100vh-320px)] overflow-y-auto pr-2 custom-scrollbar">
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-6 pb-4">
                {visibleStocks.map((stock, index) => (
                  <StockCard
                    key={stock.fullSymbol || `${stock.symbol}-${index}`}
                    stock={stock}
                    onOpenChart={() => actions.openChart(stock.symbol)}
                  />
                ))}
              </div>
              
              {displayLimit < filteredStocks.length && (
                <div className="mt-8 flex justify-center pb-8 sticky bottom-0 pointer-events-none">
                  <button
                    onClick={() => actions.setDisplayLimit(displayLimit + 24)}
                    className="pointer-events-auto px-10 py-4 bg-slate-900 border border-slate-800 shadow-2xl rounded-2xl hover:bg-slate-800 transition-all group overflow-hidden relative"
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-indigo-600/20 to-violet-600/20 opacity-0 group-hover:opacity-100 transition-opacity" />
                    <span className="relative text-[11px] font-black uppercase tracking-[0.3em] text-white">
                      Discover Next 24 Assets
                    </span>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {chartSymbol && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-6">
          <button
            aria-label="Close chart modal"
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-md"
            onClick={() => actions.closeChart()}
          />

          <div className="relative w-full max-w-[1280px] rounded-[2.5rem] border border-slate-200 bg-white shadow-2xl overflow-hidden animate-modal-enter">
            <div className="flex items-center justify-between px-8 py-5 border-b border-slate-100 bg-slate-50/50">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-lg shadow-indigo-200">
                  <Activity size={20} />
                </div>
                <div>
                  <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">{chartSymbol}</h3>
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Security Performance Analytics</p>
                </div>
              </div>

              <button
                onClick={() => actions.closeChart()}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-900 hover:bg-slate-200 transition-all border border-transparent hover:border-slate-300"
                aria-label="Close"
              >
                <X size={20} />
              </button>
            </div>

            <div className="h-[70vh] min-h-[500px]">
              <PriceChart
                symbol={chartSymbol}
                activeTimeframe={activeTimeframe}
                onTimeframeChange={setActiveTimeframe}
                chartData={chartHistory.chartData}
                isLoading={chartHistory.isLoading}
                error={chartHistory.error}
              />
            </div>

            <div className="flex items-center justify-end gap-3 px-8 py-5 border-t border-slate-100 bg-white">
              <button
                onClick={() => actions.closeChart()}
                className="px-6 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-[11px] font-black uppercase tracking-widest hover:bg-slate-50 transition-colors"
              >
                Close View
              </button>
              <button
                onClick={() => {
                  const symbol = chartSymbol;
                  actions.closeChart();
                  navigate(`/trade?symbol=${symbol}&side=BUY`);
                }}
                className="px-6 py-2.5 rounded-xl bg-indigo-600 text-white text-[11px] font-black uppercase tracking-widest hover:bg-indigo-500 transition-all shadow-lg shadow-indigo-200"
              >
                Execute Trade
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MarketExplorer;
