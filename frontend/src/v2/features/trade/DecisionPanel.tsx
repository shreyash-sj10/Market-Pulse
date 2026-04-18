import { useState, useEffect, useMemo, useCallback } from "react";
import { X, Loader, CheckCircle, AlertTriangle } from "lucide-react";
import type { TradePanelContext } from "../../trade-flow";
import { useMarketQuote } from "../../hooks/useMarketQuote";
import { useJournalPage } from "../../hooks/useJournalDecisions";
import { usePortfolioSummary } from "../../hooks/usePortfolioSummary";
import { usePortfolioDecisions } from "../../pages/portfolio/usePortfolioDecisions";
import { buildTradingSystemPolicy } from "../../behavior/behavioralSystemPolicy";
import { runPreTrade, executeTrade } from "../../api/trade.api";
import type { PreTradeResult } from "../../api/trade.api";
import { fromPaise } from "../../../utils/currency.utils";
import { queryClient } from "../../../queryClient";
import { queryKeys } from "../../queryKeys";
import { useNavigate } from "react-router-dom";
import { ROUTES } from "../../routing/routes";
import { TRADE_SUCCESS_SESSION_KEY } from "../../trade-flow";
import TradePanelOverlay from "./terminal/TradePanelOverlay";
import TradeHeader from "./terminal/TradeHeader";
import TradeInputs from "./terminal/TradeInputs";
import ValidationEngineView from "./terminal/ValidationEngineView";
import { hasBlockingLocalIssues } from "./terminal/riskLocalGate";
import ThesisInput from "./terminal/ThesisInput";
import type { TradeOutcomeVisual } from "./terminal/DecisionResult";
import { buildTradeEvaluation, type TradeEvaluation } from "./terminal/tradeEvaluation";
import DecisionActionBar from "./terminal/DecisionActionBar";
import TradeSystemContext from "./terminal/TradeSystemContext";
import TradeSystemVerdict from "./terminal/TradeSystemVerdict";
import {
  analyzeButtonLabel,
  executeButtonLabel,
  reviewGateVerdict,
  setupGateVerdict,
} from "./terminal/executionGateUi";

type Phase = "SETUP" | "ANALYZING" | "REVIEW" | "EXECUTING" | "SUCCESS" | "ERROR";

type Props = {
  open: boolean;
  symbol: string | null;
  context: TradePanelContext | null;
  onClose: () => void;
  /** Backdrop treatment when opened from Markets. */
  backdrop?: "default" | "markets";
};

export default function DecisionPanel({ open, symbol, context, onClose, backdrop = "default" }: Props) {
  const navigate = useNavigate();
  const journal = useJournalPage();
  const { summary: portfolio } = usePortfolioSummary();
  const portfolioDecisions = usePortfolioDecisions();
  const systemPolicy = useMemo(
    () => buildTradingSystemPolicy(journal.logs, journal.engine, portfolio),
    [journal.logs, journal.engine, portfolio],
  );
  const thesisMin = systemPolicy.behaviorLayer.thesisMinChars;
  const scalingBlocked = systemPolicy.behaviorLayer.scalingBlocked;

  const { quote } = useMarketQuote(open ? symbol : null);
  const livePriceINR = quote ? fromPaise(quote.pricePaise).toFixed(2) : "";

  const [side, setSide] = useState<"BUY" | "SELL">("BUY");
  const [quantity, setQuantity] = useState("1");
  const [price, setPrice] = useState("");
  const [stopLoss, setStopLoss] = useState("");
  const [target, setTarget] = useState("");
  const [thinking, setThinking] = useState("");

  const [phase, setPhase] = useState<Phase>("SETUP");
  const [preTrade, setPreTrade] = useState<PreTradeResult | null>(null);
  const [evaluation, setEvaluation] = useState<TradeEvaluation | null>(null);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    if (open) {
      setPhase("SETUP");
      setPreTrade(null);
      setEvaluation(null);
      setErrorMsg("");
      setQuantity("1");
      setStopLoss("");
      setTarget("");
      setThinking("");
    }
  }, [open, symbol]);

  useEffect(() => {
    if (livePriceINR) setPrice(livePriceINR);
  }, [livePriceINR]);

  useEffect(() => {
    const m = context?.meta as { side?: string; quantity?: number } | undefined;
    if (m?.side === "BUY" || m?.side === "SELL") setSide(m.side);
    if (m?.quantity != null) setQuantity(String(m.quantity));
  }, [context]);

  const toInt = useCallback((v: string): number => Math.round(parseFloat(v || "0") * 100), []);

  const headerPrice = useMemo(() => {
    if (quote?.pricePaise) return `₹${fromPaise(quote.pricePaise).toFixed(2)}`;
    const p = parseFloat(price);
    if (p > 0) return `₹${p.toFixed(2)}`;
    return "—";
  }, [quote?.pricePaise, price]);

  const changePct = context?.meta?.changePct ?? null;
  const decision = context?.decision ?? { action: "GUIDE" as const, confidence: 0, reason: "" };

  const { breachPositionCount, stressedPositionCount, openPositionCount } = useMemo(() => {
    const items = portfolioDecisions.items;
    const breach = items.filter((i) => !i.decision.allowed || i.decision.action === "BLOCK").length;
    const stress = items.filter((i) => (i.meta?.pnlPct ?? 0) < -3).length;
    return {
      breachPositionCount: breach,
      stressedPositionCount: stress,
      openPositionCount: items.length,
    };
  }, [portfolioDecisions.items]);

  const reviewJudgment = useMemo(() => reviewGateVerdict(evaluation), [evaluation]);

  const quantitySystemHint = useMemo(() => {
    if (scalingBlocked) return "System cap: 1 share until journal unlock (scaling lock).";
    if (systemPolicy.portfolioLayer.defensive || decision.action === "GUIDE")
      return "Suggested size: 1 share under elevated portfolio / signal risk.";
    return undefined;
  }, [scalingBlocked, systemPolicy.portfolioLayer.defensive, decision.action]);

  const stopSystemNote =
    side === "BUY"
      ? "Stop required by execution policy — must sit below limit entry; target above entry."
      : undefined;

  const snap = preTrade?.data?.snapshot ?? null;
  const authorityVerdict = preTrade?.data?.authority?.verdict ?? null;

  const reviewJudgmentOutcome: TradeOutcomeVisual = useMemo(() => {
    if (phase !== "REVIEW" || !evaluation) return "pending";
    if (evaluation.status === "VALID") return "valid";
    if (evaluation.status === "ADJUST") return "adjust";
    return "blocked";
  }, [phase, evaluation]);

  const reviewJudgmentMessage = evaluation?.messages?.length ? evaluation.messages[0] : "";

  const decisionResultVisual: TradeOutcomeVisual =
    phase === "SETUP" || phase === "ANALYZING" ? "pending" : phase === "REVIEW" ? reviewJudgmentOutcome : "pending";

  const localGate = useMemo(
    () =>
      hasBlockingLocalIssues({
        side,
        price,
        quantity,
        stopLoss,
        target,
        thesis: thinking,
        thesisMin,
        scalingBlocked,
      }),
    [side, price, quantity, stopLoss, target, thinking, thesisMin, scalingBlocked],
  );

  const setupJudgment = useMemo(
    () => setupGateVerdict(decision, systemPolicy, localGate),
    [decision, systemPolicy, localGate],
  );

  const canAnalyze =
    Boolean(symbol) &&
    !localGate &&
    thinking.trim().length >= thesisMin &&
    phase === "SETUP" &&
    decision.action !== "BLOCK";

  const canExecute = useMemo(() => {
    if (phase !== "REVIEW" || evaluation?.status !== "VALID") return false;
    if (!preTrade?.data?.authority?.token || !symbol) return false;
    return true;
  }, [phase, evaluation, preTrade, symbol]);

  const epNum = parseFloat(price || "0");
  const slNum = parseFloat(stopLoss || "0");
  const tpNum = parseFloat(target || "0");
  const stopOk =
    side === "SELL" || (epNum > 0 && slNum > 0 && tpNum > 0 && slNum < epNum && tpNum > epNum);
  const thesisOk = thinking.trim().length >= thesisMin;
  const riskBandOk = decision.action !== "BLOCK";

  const setupChecklist = useMemo(
    () => [
      {
        id: "stop",
        ok: stopOk,
        label:
          side === "BUY"
            ? "Stop loss valid (below entry, target above)"
            : "Sell-side size path (no buy bracket)",
      },
      { id: "thesis", ok: thesisOk, label: `Thesis entered (≥ ${thesisMin} chars)` },
      { id: "risk", ok: riskBandOk, label: "Market risk band acceptable (not BLOCK)" },
    ],
    [stopOk, thesisOk, riskBandOk, side, thesisMin],
  );

  const reviewChecklist = useMemo(
    () => [
      { id: "stop", ok: stopOk, label: side === "BUY" ? "Stop loss valid" : "Sell bracket" },
      { id: "thesis", ok: thesisOk, label: "Thesis on file" },
      {
        id: "risk",
        ok: evaluation?.status === "VALID",
        label: "Risk evaluation: acceptable for submit",
      },
    ],
    [stopOk, thesisOk, evaluation?.status, side],
  );

  const analyzeLabel = analyzeButtonLabel(localGate, decision, canAnalyze, systemPolicy);
  const executeLabel = executeButtonLabel(canExecute, evaluation, systemPolicy);

  const handleAnalyze = async () => {
    if (!symbol) return;
    const pricePaise = toInt(price);
    const qtyInt = parseInt(quantity || "1", 10);
    const slPaise = toInt(stopLoss);
    const tpPaise = toInt(target);
    const thesis = thinking.trim();

    if (pricePaise <= 0 || qtyInt <= 0) {
      setErrorMsg("Enter a valid limit price and quantity before evaluation.");
      setPhase("ERROR");
      return;
    }
    if (side === "BUY" && (slPaise <= 0 || tpPaise <= 0)) {
      setErrorMsg("Buy orders require both stop loss and target before evaluation.");
      setPhase("ERROR");
      return;
    }
    if (thesis.length < thesisMin) {
      setErrorMsg(`Add a trade thesis of at least ${thesisMin} characters before evaluation.`);
      setPhase("ERROR");
      return;
    }

    setPhase("ANALYZING");
    setErrorMsg("");
    setEvaluation(null);
    try {
      const result = await runPreTrade({
        side,
        symbol,
        quantity: qtyInt,
        pricePaise,
        stopLossPaise: side === "BUY" ? slPaise : undefined,
        targetPricePaise: side === "BUY" ? tpPaise : undefined,
        userThinking: thesis,
      });
      const ev = buildTradeEvaluation(result);
      setEvaluation(ev);
      if (!result.success) {
        setPreTrade(null);
        setErrorMsg(ev.messages[0] ?? "Evaluation failed.");
        setPhase("ERROR");
        return;
      }
      if (!result.data?.snapshot) {
        setPreTrade(null);
        setErrorMsg("Evaluation returned no risk snapshot. Run ANALYZE RISK again.");
        setPhase("ERROR");
        return;
      }
      const authTok = result.data?.authority?.token ?? result.data?.token;
      if (!authTok) {
        setPreTrade(null);
        setErrorMsg(
          "Evaluation succeeded but no authority token was returned. Refresh and run ANALYZE RISK again, or check the pre-trade service.",
        );
        setPhase("ERROR");
        return;
      }
      setPreTrade(result);
      setPhase("REVIEW");
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        (err as Error)?.message ??
        "Evaluation could not complete. Check inputs and try again.";
      setEvaluation(null);
      setErrorMsg(msg);
      setPhase("ERROR");
    }
  };

  const handleExecute = async () => {
    if (evaluation?.status !== "VALID" || !preTrade?.data?.authority?.token || !symbol) return;
    const pricePaise = toInt(price);
    const qtyInt = parseInt(quantity || "1", 10);
    const slPaise = toInt(stopLoss);
    const tpPaise = toInt(target);
    const token = preTrade.data.authority.token;
    const verdict = preTrade.data.authority.verdict;

    if (!canExecute) return;

    setPhase("EXECUTING");
    try {
      await executeTrade({
        side,
        symbol,
        quantity: qtyInt,
        pricePaise,
        stopLossPaise: side === "BUY" ? slPaise : undefined,
        targetPricePaise: side === "BUY" ? tpPaise : undefined,
        preTradeToken: token,
        decisionContext: {
          source: "NOESIS_PANEL",
          verdict,
          score: preTrade.data?.snapshot?.risk?.score,
          thesis: thinking.trim(),
          behavioralLoop: {
            dominantBias: systemPolicy.behaviorLayer.activeBiasTag,
            scalingBlocked,
            thesisMandatory: systemPolicy.behaviorLayer.thesisMandatory,
            journalSeverity: systemPolicy.journalSignals.severity,
            journalConfidenceMean: systemPolicy.journalSignals.confidence,
            portfolioDefensive: systemPolicy.portfolioLayer.defensive,
            criticalBreaches: systemPolicy.criticalBreaches,
            systemVerdict: systemPolicy.verdictLayer.headline,
          },
        },
        userThinking: thinking.trim(),
      });

      sessionStorage.setItem(TRADE_SUCCESS_SESSION_KEY, "1");
      setPhase("SUCCESS");

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.portfolio }),
        queryClient.invalidateQueries({ queryKey: queryKeys.portfolioSummary }),
        queryClient.invalidateQueries({ queryKey: queryKeys.journal }),
        queryClient.invalidateQueries({ queryKey: queryKeys.profile }),
        queryClient.invalidateQueries({ queryKey: queryKeys.trace }),
        queryClient.invalidateQueries({ queryKey: queryKeys.attention }),
        queryClient.invalidateQueries({ queryKey: queryKeys.markets }),
      ]);

      setTimeout(() => {
        onClose();
        navigate(ROUTES.portfolio);
      }, 1400);
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        (err as Error)?.message ??
        "Order could not be submitted. No change was made to your portfolio.";
      setErrorMsg(msg);
      setPhase("ERROR");
    }
  };

  if (!open || !symbol) return null;

  const overlayBackdrop = backdrop === "markets" ? "markets" : "default";

  return (
    <TradePanelOverlay open={open} onClose={onClose} backdrop={overlayBackdrop}>
      <div
        className="trade-terminal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="trade-terminal-title"
      >
        <button type="button" className="trade-terminal__close" onClick={onClose} aria-label="Close trade workspace">
          <X size={18} />
        </button>

        <TradeHeader
          symbol={symbol}
          priceDisplay={headerPrice}
          changePct={changePct}
          signal={decision.action}
          subline="System-controlled execution — inputs evaluated before release"
        />

        <div className="trade-terminal__body">
          {phase === "SETUP" && (
            <>
              <TradeSystemContext
                policy={systemPolicy}
                decision={decision}
                breachPositionCount={breachPositionCount}
                stressedPositionCount={stressedPositionCount}
                openPositionCount={openPositionCount}
              />
              <TradeSystemVerdict verdict={setupJudgment.verdict} explanation={setupJudgment.explanation} />
              <ThesisInput
                value={thinking}
                onChange={setThinking}
                minLength={thesisMin}
                mandatory={systemPolicy.behaviorLayer.thesisMandatory}
              />
              <TradeInputs
                side={side}
                onSideChange={setSide}
                price={price}
                onPriceChange={setPrice}
                quantity={quantity}
                onQuantityChange={setQuantity}
                stopLoss={stopLoss}
                onStopLossChange={setStopLoss}
                target={target}
                onTargetChange={setTarget}
                livePriceHint={livePriceINR ? ` · Live reference ₹${livePriceINR}` : undefined}
                quantitySystemHint={quantitySystemHint}
                stopSystemNote={stopSystemNote}
              />
              <ValidationEngineView
                outcome={localGate ? "adjust" : "pending"}
                message={
                  localGate
                    ? "System checks failed — fix items in the gate list, then run the risk gate."
                    : "Real-time checks below. Run the risk gate when the list is clear."
                }
                mode="local"
                side={side}
                price={price}
                quantity={quantity}
                stopLoss={stopLoss}
                target={target}
                thesis={thinking}
                thesisMin={thesisMin}
                scalingBlocked={scalingBlocked}
                snapshot={null}
                authorityVerdict={null}
                analyzing={false}
              />
              <DecisionActionBar
                phase="setup"
                primaryLabel={analyzeLabel}
                canPrimary={canAnalyze}
                onPrimary={handleAnalyze}
                onCancel={onClose}
                checklist={setupChecklist}
              />
            </>
          )}

          {phase === "ANALYZING" && (
            <div className="trade-terminal-center">
              <Loader size={28} className="dp-spinner" aria-hidden />
              <p className="trade-terminal-center__title">Evaluating trade</p>
              <p className="trade-terminal-center__sub">Risk, behavior, and rule alignment</p>
            </div>
          )}

          {phase === "REVIEW" && snap && (
            <>
              <TradeSystemContext
                policy={systemPolicy}
                decision={decision}
                breachPositionCount={breachPositionCount}
                stressedPositionCount={stressedPositionCount}
                openPositionCount={openPositionCount}
              />
              <TradeSystemVerdict verdict={reviewJudgment.verdict} explanation={reviewJudgment.explanation} />
              <ValidationEngineView
                outcome={decisionResultVisual}
                message={
                  reviewJudgmentMessage ||
                  "Risk evaluation complete. Review system checks before execution."
                }
                mode="server"
                side={side}
                price={price}
                quantity={quantity}
                stopLoss={stopLoss}
                target={target}
                thesis={thinking}
                thesisMin={thesisMin}
                scalingBlocked={scalingBlocked}
                snapshot={snap}
                authorityVerdict={authorityVerdict}
                analyzing={false}
              />
              <p className="trade-terminal-recap">
                <span className="trade-terminal-recap__sym">{symbol}</span>
                <span className="trade-terminal-recap__side">{side}</span>
                <span>
                  {quantity} @ ₹{parseFloat(price || "0").toFixed(2)}
                </span>
                {side === "BUY" ? (
                  <span>
                    {" "}
                    · SL ₹{parseFloat(stopLoss || "0").toFixed(2)} · TP ₹{parseFloat(target || "0").toFixed(2)}
                  </span>
                ) : null}
              </p>
              <DecisionActionBar
                phase="review"
                primaryLabel={executeLabel}
                canPrimary={canExecute}
                onPrimary={handleExecute}
                onCancel={onClose}
                checklist={reviewChecklist}
              />
            </>
          )}

          {phase === "EXECUTING" && (
            <div className="trade-terminal-center">
              <Loader size={28} className="dp-spinner" aria-hidden />
              <p className="trade-terminal-center__title">Submitting order</p>
              <p className="trade-terminal-center__sub">
                {side} · {symbol}
              </p>
            </div>
          )}

          {phase === "SUCCESS" && (
            <div className="trade-terminal-center">
              <CheckCircle size={36} className="trade-terminal-center__ok" aria-hidden />
              <p className="trade-terminal-center__title">Order accepted</p>
              <p className="trade-terminal-center__sub">
                Portfolio updating · journal will bind on close · behavioral loop closed
              </p>
            </div>
          )}

          {phase === "ERROR" && (
            <div className="trade-terminal-error">
              <AlertTriangle size={28} aria-hidden />
              <p className="trade-terminal-error__msg">{errorMsg || "Something went wrong."}</p>
              <div className="trade-terminal-actions trade-terminal-actions--inline">
                <button
                  type="button"
                  className="trade-terminal-btn trade-terminal-btn--primary"
                  onClick={() => {
                    setPreTrade(null);
                    setEvaluation(null);
                    setPhase("SETUP");
                    setErrorMsg("");
                  }}
                >
                  Back to inputs
                </button>
                <button type="button" className="trade-terminal-btn trade-terminal-btn--secondary" onClick={onClose}>
                  Close
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </TradePanelOverlay>
  );
}
