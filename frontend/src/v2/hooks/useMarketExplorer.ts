import { useCallback } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import api from "../api/api.js";

export interface MarketStock {
  symbol:        string;
  fullSymbol:    string;
  pricePaise:    number;
  changePercent: number;
  volume:        number;
  marketCap:     number | null;
  peRatio:       number | null;
  trend:         "BULLISH" | "BEARISH" | "SIDEWAYS";
  source:        string;
  isSynthetic:   boolean;
  isFallback:    boolean;
}

export type MarketSegment = "all" | "large" | "mid" | "small";

export interface ExplorerMeta {
  isSynthetic: boolean;
  isFallback:  boolean;
  poolEnd?:    number;
  hasMore?:    boolean;
}

interface ExploreResponse {
  stocks: MarketStock[];
  meta:   ExplorerMeta;
}

export const MARKET_EXPLORE_PAGE_SIZE = 64;

async function fetchExplore(
  search: string,
  offset: number,
  segment: MarketSegment,
): Promise<ExploreResponse> {
  const params = new URLSearchParams({
    limit:   String(MARKET_EXPLORE_PAGE_SIZE),
    offset:  String(offset),
    segment: segment === "all" ? "all" : segment,
  });
  if (search) params.set("query", search);
  const res = await api.get(`/market/explore?${params.toString()}`);
  return {
    stocks: res.data?.stocks ?? [],
    meta:   res.data?.meta ?? { isSynthetic: false, isFallback: false },
  };
}

export function useMarketExplorer(search = "", segment: MarketSegment = "all") {
  const query = useInfiniteQuery<ExploreResponse, Error>({
    queryKey:        ["market", "explore", search, segment],
    queryFn:         ({ pageParam }) => fetchExplore(search, pageParam as number, segment),
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) => {
      if (lastPage.stocks.length === 0) return undefined;
      if (lastPage.meta?.hasMore === false) return undefined;
      const fullPage = lastPage.stocks.length >= MARKET_EXPLORE_PAGE_SIZE;
      if (typeof lastPage.meta?.poolEnd === "number") {
        if (fullPage || lastPage.meta?.hasMore === true) return lastPage.meta.poolEnd;
      }
      if (!fullPage) return undefined;
      return allPages.length * MARKET_EXPLORE_PAGE_SIZE;
    },
    refetchInterval: 60_000,
    staleTime:       30_000,
    retry:           1,
  });

  const allStocks: MarketStock[] = query.data?.pages.flatMap((p) => p.stocks) ?? [];
  const lastPage = query.data?.pages[query.data.pages.length - 1];
  const meta: ExplorerMeta = lastPage?.meta ?? { isSynthetic: false, isFallback: false };

  const loadMore = useCallback(() => {
    if (query.hasNextPage && !query.isFetchingNextPage) void query.fetchNextPage();
  }, [query.hasNextPage, query.isFetchingNextPage, query.fetchNextPage]);

  return {
    stocks:            allStocks,
    meta,
    isLoading:         query.isPending,
    isFetching:        query.isFetching,
    isFetchingMore:    query.isFetchingNextPage,
    isError:           query.isError,
    hasMore:           query.hasNextPage ?? false,
    loadMore,
  };
}
