import React, { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { TradeForm } from "./TradeForm";
import { TradeReview } from "./TradeReview";
import { TradeActions } from "./TradeActions";
import { usePreTradeAudit } from "../../hooks/usePreTrade";
import { useBuyTrade, useSellTrade } from "../../hooks/useTrades";
import type { PreTradeResponse } from "../../contracts/preTrade";

type TerminalStep = "PLAN" | "REVIEW" | "EXECUTING" | "CONFIRMED";

export const TradeTerminal: React.FC = () => {
  const queryClient = useQueryClient();
  const [step, setStep] = useState<TerminalStep>("PLAN");
  const [formData, setFormData] = useState<any>(null);
  const [reviewResult, setReviewResult] = useState<PreTradeResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const preTradeMutation = usePreTradeAudit();
  const buyMutation = useBuyTrade();
  const sellMutation = useSellTrade();

  const handleReview = async (data: any) => {
    setError(null);
    setFormData(data);
    try {
      const result = await preTradeMutation.mutateAsync({
        symbol: data.symbol,
        type: data.side,
        quantity: data.quantity,
        pricePaise: data.pricePaise,
        stopLossPaise: data.stopLossPaise,
        targetPricePaise: data.targetPricePaise,
        userThinking: data.userThinking,
      });
      
      if (result.success) {
        setReviewResult(result.data);
        setStep("REVIEW");
      } else {
        setError("Pre-trade audit failed to communicate with server.");
      }
    } catch (e: any) {
      setError(e.message || "Network error during pre-trade audit.");
    }
  };

  const handleConfirm = async () => {
    if (!reviewResult?.token || !formData) return;
    
    setError(null);
    setStep("EXECUTING");

    try {
      const mutation = formData.side === "BUY" ? buyMutation : sellMutation;
      const result = await mutation.mutateAsync({
        symbol: formData.symbol,
        quantity: formData.quantity,
        pricePaise: formData.pricePaise,
        userThinking: formData.userThinking,
        preTradeToken: reviewResult.token,
      });

      if (result.success) {
        setStep("CONFIRMED");
      } else {
        setStep("REVIEW");
        setError("Execution failed.");
      }
    } catch (e: any) {
      setStep("REVIEW");
      setError(e.message || "Execution error.");
    }
  };

  const handleReset = () => {
    setStep("PLAN");
    setFormData(null);
    setReviewResult(null);
    setError(null);
  };

  return (
    <div className="trade-terminal-module">
      <h2>Institutional Trade Terminal</h2>

      {error && <div className="error-banner">{error}</div>}

      {step === "PLAN" && (
        <TradeForm onReview={handleReview} disabled={preTradeMutation.isPending} />
      )}

      {step === "REVIEW" && reviewResult && (
        <>
          <TradeReview reviewResult={reviewResult} />
          <TradeActions
            onConfirm={handleConfirm}
            onCancel={handleReset}
            isExecuting={buyMutation.isPending || sellMutation.isPending}
            canExecute={reviewResult.allowed}
          />
        </>
      )}

      {step === "EXECUTING" && (
        <div className="executing-state">
          <p>Processing order with clearing bank...</p>
        </div>
      )}

      {step === "CONFIRMED" && (
        <div className="confirmation-state">
          <h3>Order Executed Successfully</h3>
          <p>Your institutional position has been committed.</p>
          <button onClick={handleReset}>New Trade</button>
        </div>
      )}

      {preTradeMutation.isPending && <div className="loading">Auditing trade setup...</div>}
    </div>
  );
};
