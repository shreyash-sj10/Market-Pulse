import { useDeferredValue, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  getExplorerData,
  getHistoricalPrices,
  getMarketIndices,
} from "../services/market.api";
import {
  getGlobalIntelligence,
  getMarketIntelligence,
  getPortfolioIntelligence,
} from "../services/intelligence.api";
import { calculateEMA } from "../utils/chartHelpers";
import { calculateRSI, calculateVolumeColors } from "../features/trades/utils/indicators";
import {
  normalizeExplorerPayload,
  normalizeHistoryPayload,
  normalizeIntelligencePayload,
  normalizeMarketIndices,
} from "../adapters/market.adapter";
import { queryKeys, QUERY_KEYS } from "../constants/queryKeys";

export function useMarketStatus() {
  const statusQuery = useQuery({
    queryKey: queryKeys.marketIndices(),
    queryFn: async () => normalizeMarketIndices(await getMarketIndices()),
    refetchInterval: 60000,
  });

  return {
    status: statusQuery.data,
    isLoading: statusQuery.isLoading,
  };
}

export function useMarketTicker() {
  const tickerQuery = useQuery({
    queryKey: [...QUERY_KEYS.MARKET, "indices", "ticker"],
    queryFn: async () => normalizeMarketIndices(await getMarketIndices()),
    refetchInterval: 30000,
  });

  const indices = Array.isArray(tickerQuery.data?.indices) ? tickerQuery.data.indices : [];
  return {
    indices,
    isLoading: tickerQuery.isLoading,
  };
}

export function useMarketExplorer() {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("ALL");
  const [capFilter, setCapFilter] = useState("ALL");
  const [displayLimit, setDisplayLimit] = useState(24);
  const [chartSymbol, setChartSymbol] = useState("");
  const deferredSearch = useDeferredValue(search);

  const explorerQuery = useQuery({
    queryKey: queryKeys.marketExplorer(),
    queryFn: async () => normalizeExplorerPayload(await getExplorerData(500, 0, "")),
    refetchInterval: 60000,
  });

  const allStocks = useMemo(() => explorerQuery.data?.stocks || [], [explorerQuery.data]);
  const explorerMeta = explorerQuery.data?.meta || { isSynthetic: false, isFallback: false };

  const filteredStocks = useMemo(() => {
    return allStocks.filter((stock) => {
      const matchesSearch = stock.symbol
        .toLowerCase()
        .includes(deferredSearch.toLowerCase());

      let matchesFilter = true;
      if (filter === "GAINERS") matchesFilter = stock.changePercent > 0;
      else if (filter === "LOSERS") matchesFilter = stock.changePercent < 0;

      let matchesCap = true;
      const cr = (stock.marketCap || 0) / 10000000;
      if (capFilter === "LARGE") matchesCap = cr >= 20000;
      else if (capFilter === "MID") matchesCap = cr >= 5000 && cr < 20000;
      else if (capFilter === "SMALL") matchesCap = cr < 5000;

      return matchesSearch && matchesFilter && matchesCap;
    });
  }, [allStocks, deferredSearch, filter, capFilter]);

  const visibleStocks = useMemo(() => {
    return filteredStocks.slice(0, displayLimit);
  }, [filteredStocks, displayLimit]);

  return {
    state: {
      search,
      filter,
      capFilter,
      displayLimit,
      chartSymbol,
      deferredSearch,
    },
    actions: {
      setSearch,
      setFilter,
      setCapFilter,
      setDisplayLimit,
      openChart: setChartSymbol,
      closeChart: () => setChartSymbol(""),
      refresh: explorerQuery.refetch,
    },
    data: {
      allStocks,
      filteredStocks,
      visibleStocks,
      explorerMeta,
    },
    query: {
      isLoading: explorerQuery.isLoading,
      isFetching: explorerQuery.isFetching,
      isError: explorerQuery.isError,
    },
  };
}

export function useMarketIntelligence() {
  const marketQuery = useQuery({
    queryKey: queryKeys.marketIntelligence("market"),
    queryFn: async () => normalizeIntelligencePayload(await getMarketIntelligence()),
    staleTime: 1000 * 60 * 5,
  });
  const portfolioQuery = useQuery({
    queryKey: queryKeys.marketIntelligence("portfolio"),
    queryFn: async () => normalizeIntelligencePayload(await getPortfolioIntelligence()),
    staleTime: 1000 * 60 * 5,
  });
  const globalQuery = useQuery({
    queryKey: queryKeys.marketIntelligence("global"),
    queryFn: async () => normalizeIntelligencePayload(await getGlobalIntelligence()),
    staleTime: 1000 * 60 * 5,
  });

  const portfolioSignals = useMemo(() => {
    return [...(portfolioQuery.data?.signals || [])].sort(
      (a, b) => (b.confidence ?? -1) - (a.confidence ?? -1),
    );
  }, [portfolioQuery.data]);

  const sectorIntelligence = useMemo(() => {
    const allSignals = [
      ...(marketQuery.data?.signals || []),
      ...(portfolioQuery.data?.signals || []),
    ];
    return allSignals.reduce((acc, signal) => {
      const sector = signal.sector || "GENERAL";
      if (!acc[sector]) {
        acc[sector] = { consensus: null, signals: [] };
      }
      if (signal.isConsensus) acc[sector].consensus = signal;
      else acc[sector].signals.push(signal);
      return acc;
    }, {});
  }, [marketQuery.data, portfolioQuery.data]);

  const globalSummary = useMemo(() => {
    const signals = globalQuery.data?.signals || [];
    if (!signals.length) return null;
    const drivers = signals.slice(0, 5).map((signal) => signal.event);
    const bullish = signals.filter((signal) => signal.impact === "BULLISH").length;
    const bearish = signals.filter((signal) => signal.impact === "BEARISH").length;
    const hasDirectional = bullish > 0 || bearish > 0;
    const bias = hasDirectional
      ? bullish > bearish
        ? "BULLISH"
        : bearish > bullish
          ? "BEARISH"
          : "MIXED"
      : "UNAVAILABLE";
    return { drivers, bias, signalCount: signals.length };
  }, [globalQuery.data]);

  const unavailableIntel =
    marketQuery.data?.status === "UNAVAILABLE" ||
    portfolioQuery.data?.status === "UNAVAILABLE" ||
    globalQuery.data?.status === "UNAVAILABLE";

  return {
    marketResp: { data: marketQuery.data },
    portResp: { data: portfolioQuery.data },
    globalResp: { data: globalQuery.data },
    isSyncing: marketQuery.isLoading || portfolioQuery.isLoading || globalQuery.isLoading,
    unavailableIntel,
    portfolioSignals,
    sectorIntelligence,
    globalSummary,
  };
}

export function useMarketHistory(symbol, activeTimeframe) {
  const historyQuery = useQuery({
    queryKey: queryKeys.marketHistory(symbol, activeTimeframe),
    queryFn: () => getHistoricalPrices(symbol.toUpperCase(), activeTimeframe),
    enabled: !!symbol,
    staleTime: 1000 * 60 * 5,
  });

  const chartData = useMemo(() => {
    const normalized = normalizeHistoryPayload(historyQuery.data);
    const prices = normalized.prices.map((point) => ({
      ...point,
      time: point.date,
    }));
    if (!prices.length) return [];
    let data = calculateEMA(prices, 20);
    data = calculateRSI(data, 14);
    data = calculateVolumeColors(data);
    return data;
  }, [historyQuery.data]);

  return {
    chartData,
    isLoading: historyQuery.isLoading,
    error: historyQuery.error,
  };
}
