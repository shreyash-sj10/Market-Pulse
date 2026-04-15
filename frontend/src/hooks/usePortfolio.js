import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { getPortfolioSummary, getPositions } from "../services/portfolio.api";
import { getTradeHistory, executeTrade } from "../services/trade.api";
import { getPortfolioNews } from "../services/market.api";
import { queryKeys, QUERY_KEYS } from "../constants/queryKeys";
import { usePreTrade } from "./usePreTrade";
import { safeArray } from "../utils/contract";

const invalidateTradeDomains = async (queryClient) => {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: QUERY_KEYS.TRADES }),
    queryClient.invalidateQueries({ queryKey: QUERY_KEYS.PORTFOLIO }),
    queryClient.invalidateQueries({ queryKey: QUERY_KEYS.JOURNAL }),
    queryClient.invalidateQueries({ queryKey: QUERY_KEYS.PROFILE }),
    queryClient.invalidateQueries({ queryKey: QUERY_KEYS.MARKET }),
    queryClient.invalidateQueries({ queryKey: QUERY_KEYS.TRACE }),
  ]);
};

export function usePortfolio() {
  const queryClient = useQueryClient();
  const { reviewTrade } = usePreTrade();

  const [selectedSellPos, setSelectedSellPos] = useState(null);
  const [sellQuantity, setSellQuantity] = useState(0);

  const summaryQuery = useQuery({
    queryKey: queryKeys.portfolioSummary(),
    queryFn: getPortfolioSummary,
    refetchInterval: 30000,
  });

  const positionsQuery = useQuery({
    queryKey: queryKeys.positions(),
    queryFn: getPositions,
    refetchInterval: 30000,
  });

  const tradesQuery = useQuery({
    queryKey: queryKeys.tradeHistory(1, 8),
    queryFn: () => getTradeHistory(1, 8),
  });

  const portfolioNewsQuery = useQuery({
    queryKey: [...QUERY_KEYS.MARKET, "portfolio-news"],
    queryFn: getPortfolioNews,
    refetchInterval: 600000,
  });

  const sellMutation = useMutation({
    mutationFn: (payload) => executeTrade(payload),
  });

  const handleSellNavigate = (position) => {
    setSelectedSellPos(position);
    setSellQuantity(position.quantity);
  };

  const handleSellQuantity = (value) => {
    if (!selectedSellPos) return;
    const normalized = Math.min(
      selectedSellPos.quantity,
      Math.max(0, parseInt(value, 10) || 0),
    );
    setSellQuantity(normalized);
  };

  const handleQuickSell = async () => {
    if (!selectedSellPos || sellQuantity <= 0) return;

    const toastId = toast.loading(`Initiating quick liquidation for ${selectedSellPos.symbol}...`);
    try {
      const preTradePayload = await reviewTrade({
        symbol: selectedSellPos.symbol,
        quantity: sellQuantity,
        pricePaise: selectedSellPos.currentPricePaise,
        side: "SELL",
        userThinking: "Direct portfolio liquidation via dashboard.",
      });

      await sellMutation.mutateAsync({
        symbol: selectedSellPos.symbol,
        side: "SELL",
        quantity: sellQuantity,
        pricePaise: selectedSellPos.currentPricePaise,
        preTradeToken: preTradePayload?.token,
        decisionContext: preTradePayload?.snapshot,
        userThinking: "Quick sell - minimal review applied.",
        idempotencyKey: `quick-exit-${selectedSellPos.symbol}-${Date.now()}`,
      });

      toast.success("Position successfully liquidated.", { id: toastId });
      setSelectedSellPos(null);
      await invalidateTradeDomains(queryClient);
    } catch (error) {
      toast.error(error?.response?.data?.message || "Liquidation failed.", { id: toastId });
    }
  };

  const summary = summaryQuery.data?.data || {};
  const summaryState = summaryQuery.data?.state || "EMPTY";
  const positions = safeArray(
    Array.isArray(positionsQuery.data)
      ? positionsQuery.data
      : positionsQuery.data?.data || [],
  );
  const portfolioState = positionsQuery.data?.state || "EMPTY";
  const trades = safeArray(
    tradesQuery.data?.data || (Array.isArray(tradesQuery.data) ? tradesQuery.data : []),
  );

  return {
    summary: {
      data: summary,
      state: summaryState,
      isLoading: summaryQuery.isLoading,
      isError: summaryQuery.isError,
      refetch: summaryQuery.refetch,
    },
    positions: {
      list: positions,
      state: portfolioState,
      isLoading: positionsQuery.isLoading,
      isError: positionsQuery.isError,
      refetch: positionsQuery.refetch,
    },
    trades: {
      list: trades,
      isLoading: tradesQuery.isLoading,
    },
    portfolioNews: {
      data: portfolioNewsQuery.data,
      isLoading: portfolioNewsQuery.isLoading,
    },
    quickSell: {
      selectedSellPos,
      sellQuantity,
      isProcessing: sellMutation.isPending,
      open: handleSellNavigate,
      close: () => setSelectedSellPos(null),
      setQuantity: handleSellQuantity,
      execute: handleQuickSell,
    },
  };
}
