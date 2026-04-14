import React, { useState } from "react";

interface TradeFormProps {
  onReview: (data: {
    symbol: string;
    side: "BUY" | "SELL";
    quantity: number;
    pricePaise: number;
    stopLossPaise?: number;
    targetPricePaise?: number;
    userThinking: string;
  }) => void;
  disabled?: boolean;
}

export const TradeForm: React.FC<TradeFormProps> = ({ onReview, disabled }) => {
  const [symbol, setSymbol] = useState("");
  const [side, setSide] = useState<"BUY" | "SELL">("BUY");
  const [quantity, setQuantity] = useState(0);
  const [pricePaise, setPricePaise] = useState(0);
  const [stopLossPaise, setStopLossPaise] = useState<number | undefined>();
  const [targetPricePaise, setTargetPricePaise] = useState<number | undefined>();
  const [userThinking, setUserThinking] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!symbol || quantity <= 0 || pricePaise <= 0 || !userThinking) return;

    onReview({
      symbol,
      side,
      quantity,
      pricePaise,
      stopLossPaise: side === "BUY" ? stopLossPaise : undefined,
      targetPricePaise: side === "BUY" ? targetPricePaise : undefined,
      userThinking,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="trade-form">
      <div className="form-group">
        <label>Symbol</label>
        <input
          type="text"
          value={symbol}
          onChange={(e) => setSymbol(e.target.value.toUpperCase())}
          placeholder="e.g. RELIANCE"
          disabled={disabled}
          required
        />
      </div>

      <div className="form-group">
        <label>Side</label>
        <select
          value={side}
          onChange={(e) => setSide(e.target.value as "BUY" | "SELL")}
          disabled={disabled}
        >
          <option value="BUY">BUY</option>
          <option value="SELL">SELL</option>
        </select>
      </div>

      <div className="form-group">
        <label>Quantity</label>
        <input
          type="number"
          value={quantity}
          onChange={(e) => setQuantity(Number(e.target.value))}
          disabled={disabled}
          required
          min="1"
        />
      </div>

      <div className="form-group">
        <label>Entry Price (Paise)</label>
        <input
          type="number"
          value={pricePaise}
          onChange={(e) => setPricePaise(Number(e.target.value))}
          disabled={disabled}
          required
          min="1"
        />
      </div>

      {side === "BUY" && (
        <>
          <div className="form-group">
            <label>Stop Loss (Paise)</label>
            <input
              type="number"
              value={stopLossPaise || ""}
              onChange={(e) => setStopLossPaise(Number(e.target.value))}
              disabled={disabled}
              required
            />
          </div>
          <div className="form-group">
            <label>Target Price (Paise)</label>
            <input
              type="number"
              value={targetPricePaise || ""}
              onChange={(e) => setTargetPricePaise(Number(e.target.value))}
              disabled={disabled}
              required
            />
          </div>
        </>
      )}

      <div className="form-group">
        <label>Rationale (User Thinking)</label>
        <textarea
          value={userThinking}
          onChange={(e) => setUserThinking(e.target.value)}
          placeholder="Why are you taking this trade?"
          disabled={disabled}
          required
        />
      </div>

      <button type="submit" disabled={disabled || !symbol || quantity <= 0 || pricePaise <= 0 || !userThinking}>
        Review Trade
      </button>
    </form>
  );
};
