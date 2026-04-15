import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { validateSymbol, getHistoricalPrices } from "../services/market.api";
import { getAdaptiveProfile } from "../services/intelligence.api";
import { executeTrade } from "../services/trade.api";
import { calculateEMA } from "../utils/chartHelpers";
import { calculateRSI } from "../features/trades/utils/indicators";
import { queryKeys, QUERY_KEYS } from "../constants/queryKeys";
import { normalizeHistoryPayload } from "../adapters/market.adapter";
import { usePreTrade } from "./usePreTrade";

const toPaise = (value) => Math.round((parseFloat(value) || 0) * 100);

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

export function useTradeFlow({ initialSymbol = "" } = {}) {
  const queryClient = useQueryClient();
  const { reviewTrade, isReviewing } = usePreTrade();

  const [symbol, setSymbol] = useState(initialSymbol.toUpperCase());
  const [quantity, setQuantity] = useState("1");
  const [priceRupees, setPriceRupees] = useState("");
  const [stopLoss, setStopLoss] = useState("");
  const [targetPrice, setTargetPrice] = useState("");
  const [userThinking, setUserThinking] = useState("");
  const [tradeIntent, setTradeIntent] = useState("TREND_FOLLOWING");

  const [step, setStep] = useState(1);
  const [showDecisionPanel, setShowDecisionPanel] = useState(false);
  const [decisionSnapshot, setDecisionSnapshot] = useState(null);
  const [executionToken, setExecutionToken] = useState(null);
  const [result, setResult] = useState(null);

  const validationQuery = useQuery({
    queryKey: queryKeys.preTrade(symbol),
    queryFn: () => validateSymbol(symbol),
    enabled: symbol.length >= 2,
    staleTime: 60000,
  });

  const personaQuery = useQuery({
    queryKey: [...QUERY_KEYS.PROFILE, "adaptive"],
    queryFn: getAdaptiveProfile,
  });

  const canProceed = useMemo(() => {
    return Boolean(
      symbol &&
        Number(quantity) > 0 &&
        Number(priceRupees) > 0 &&
        Number(stopLoss) > 0 &&
        Number(targetPrice) > 0,
    );
  }, [symbol, quantity, priceRupees, stopLoss, targetPrice]);

  const capitalCommitmentPaise = useMemo(() => {
    return Math.round((parseFloat(quantity) || 0) * (parseFloat(priceRupees) || 0) * 100);
  }, [quantity, priceRupees]);

  const executeMutation = useMutation({
    mutationFn: (payload) => executeTrade(payload),
  });

  const handleReview = async () => {
    if (!canProceed) {
      toast.error("Deployment plan incomplete. Enforce Risk/Reward integrity.");
      return;
    }

    const toastId = toast.loading("Reviewing trade architecture...");
    try {
      const payload = await reviewTrade({
        symbol,
        quantity: parseInt(quantity, 10),
        pricePaise: toPaise(priceRupees),
        stopLossPaise: toPaise(stopLoss),
        targetPricePaise: toPaise(targetPrice),
        side: "BUY",
        userThinking,
      });

      if (!payload?.allowed) {
        toast.error("Trade blocked by internal risk constraints.", { id: toastId });
        return;
      }

      setDecisionSnapshot(payload.snapshot ?? null);
      setExecutionToken(payload.token ?? null);
      setStep(2);
      setShowDecisionPanel(true);
      toast.success("Consensus reached. Ready for execution.", { id: toastId });
    } catch {
      toast.error("Decision engine timeout. Check local synchronization.", { id: toastId });
    }
  };

  const finalizeTrade = async () => {
    const toastId = toast.loading("Executing trade protocol...");
    setShowDecisionPanel(false);
    try {
      const response = await executeMutation.mutateAsync({
        symbol,
        side: "BUY",
        quantity: parseInt(quantity, 10),
        pricePaise: toPaise(priceRupees),
        stopLossPaise: toPaise(stopLoss),
        targetPricePaise: toPaise(targetPrice),
        userThinking,
        intent: tradeIntent,
        reason: userThinking,
        decisionContext: decisionSnapshot,
        preTradeToken: executionToken,
        idempotencyKey: crypto.randomUUID(),
      });

      setResult(response?.data ?? null);
      setStep(3);
      toast.success("Trade completed flawlessly.", { id: toastId });
      await invalidateTradeDomains(queryClient);
    } catch (error) {
      toast.error(error?.response?.data?.message || "Execution Engine Error", { id: toastId });
    }
  };

  const resetTrade = () => {
    setStep(1);
    setSymbol("");
    setPriceRupees("");
    setStopLoss("");
    setTargetPrice("");
    setResult(null);
    setShowDecisionPanel(false);
    setDecisionSnapshot(null);
    setExecutionToken(null);
  };

  const insightQuery = useQuery({
    queryKey: queryKeys.marketHistory(symbol, "1M"),
    queryFn: () => getHistoricalPrices(symbol.toUpperCase(), "1M"),
    enabled: Boolean(symbol && result),
    staleTime: 1000 * 60 * 5,
  });

  const tradeInsight = useMemo(() => {
    const normalized = normalizeHistoryPayload(insightQuery.data);
    if (!normalized.prices.length || !result) return null;

    let dataset = calculateEMA(normalized.prices, 20);
    dataset = calculateRSI(dataset, 14);
    const selectedPoint = dataset[dataset.length - 1];
    if (!selectedPoint) return null;

    const rsi = selectedPoint.rsi;
    const ema = selectedPoint.ema;
    const price = result.pricePaise || selectedPoint.price;
    const risk = result.analysis?.riskScore || 0;

    let rsiText = "neutral momentum";
    if (rsi > 70) rsiText = "overbought conditions";
    else if (rsi < 30) rsiText = "oversold conditions";

    let emaText = "hovering near trend";
    if (price > ema * 1.01) emaText = "above the 20-day trend line (bullish zone)";
    else if (price < ema * 0.99) emaText = "below the 20-day trend line (bearish zone)";

    const typeLabel = result.side === "BUY" ? "bought" : "sold";
    return {
      text: `Market Context: You ${typeLabel} when the asset was in ${rsiText} (RSI: ${rsi?.toFixed(1) || "N/A"}) and the execution price was ${emaText}.`,
      contextColor: risk > 70 ? "text-rose-600" : "text-emerald-600",
    };
  }, [insightQuery.data, result]);

  return {
    form: {
      symbol,
      quantity,
      priceRupees,
      stopLoss,
      targetPrice,
      userThinking,
      tradeIntent,
      setSymbol,
      setQuantity,
      setPriceRupees,
      setStopLoss,
      setTargetPrice,
      setUserThinking,
      setTradeIntent,
    },
    flow: {
      step,
      showDecisionPanel,
      decisionSnapshot,
      result,
      isExecuting: executeMutation.isPending,
      isReviewing,
      canProceed,
      capitalCommitmentPaise,
      openDecisionPanel: () => setShowDecisionPanel(true),
      closeDecisionPanel: () => setShowDecisionPanel(false),
      handleReview,
      finalizeTrade,
      resetTrade,
    },
    validation: {
      data: validationQuery.data,
      isLoading: validationQuery.isLoading || validationQuery.isFetching,
    },
    persona: {
      data: personaQuery.data?.data ?? null,
      isLoading: personaQuery.isLoading,
    },
    insight: {
      data: tradeInsight,
      isLoading: insightQuery.isLoading,
    },
  };
}
