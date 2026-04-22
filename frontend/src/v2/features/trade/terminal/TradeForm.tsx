export type TradeFormProps = {
  side: "BUY" | "SELL";
  onSideChange: (s: "BUY" | "SELL") => void;
  /** Long-only: exit leg only when there is an open position in this symbol (no short). */
  showPortfolioExit?: boolean;
  /** Max quantity closable from portfolio (for copy / validation hints). */
  exitMaxQuantity?: number;
  productType: "DELIVERY" | "INTRADAY";
  onProductTypeChange: (v: "DELIVERY" | "INTRADAY") => void;
  price: string;
  onPriceChange: (v: string) => void;
  quantity: string;
  onQuantityChange: (v: string) => void;
  stopLoss: string;
  onStopLossChange: (v: string) => void;
  target: string;
  onTargetChange: (v: string) => void;
  livePriceHint?: string;
  /** System-suggested max attention size (friction, not auto-fill). */
  quantitySystemHint?: string;
  /** Buy-side stop enforced by policy copy. */
  stopSystemNote?: string;
  /** Decision-first surface — renames section kickers only. */
  executionSurface?: boolean;
};

export default function TradeForm({
  side,
  onSideChange,
  productType,
  onProductTypeChange,
  price,
  onPriceChange,
  quantity,
  onQuantityChange,
  stopLoss,
  onStopLossChange,
  target,
  onTargetChange,
  livePriceHint,
  quantitySystemHint,
  stopSystemNote,
  showPortfolioExit = false,
  exitMaxQuantity = 0,
  executionSurface = false,
}: TradeFormProps) {
  const intentKicker = executionSurface ? "Execution intent" : "Action";
  const execKicker = executionSurface ? "Execution inputs" : "Order entry";
  const riskKicker = executionSurface ? "Risk definition" : "Risk bracket";
  const ep = parseFloat(price);
  const sl = parseFloat(stopLoss);
  const tp = parseFloat(target);
  const showRr = side === "BUY" && ep > 0 && sl > 0 && tp > 0 && tp > ep && sl < ep;
  const rr = showRr ? (tp - ep) / (ep - sl) : null;

  return (
    <div className="trade-terminal-section">
      <div className="rounded-xl border border-slate-800/80 bg-slate-900/35 px-3 py-3 md:px-4">
        <p className="trade-terminal-kicker">{intentKicker}</p>
        <div
          className={`dp-side-toggle trade-terminal-side-toggle ${!showPortfolioExit ? "trade-terminal-side-toggle--buy-only" : ""}`}
        >
          <button
            type="button"
            className={`dp-side-btn dp-side-btn--buy ${side === "BUY" ? "dp-side-btn--active" : ""}`}
            onClick={() => onSideChange("BUY")}
          >
            Buy
          </button>
          {showPortfolioExit ? (
            <button
              type="button"
              className={`dp-side-btn dp-side-btn--sell ${side === "SELL" ? "dp-side-btn--active" : ""}`}
              onClick={() => onSideChange("SELL")}
              title="Close an existing holding (same quantity rules as Portfolio)"
            >
              Exit
            </button>
          ) : null}
        </div>
        {!showPortfolioExit ? (
          <p className="trade-terminal-field-hint">
            Long-only — to close a line you already hold, open Exit from Portfolio (this panel stays buy-to-open).
          </p>
        ) : exitMaxQuantity > 0 ? (
          <p className="trade-terminal-field-hint">
            Open position: up to <span className="trade-terminal-mono">{exitMaxQuantity}</span> shares closable here.
          </p>
        ) : null}

        {side === "BUY" ? (
          <>
            <p className="trade-terminal-kicker trade-terminal-kicker--spaced">Product</p>
            <div className="dp-side-toggle trade-terminal-product-toggle">
              <button
                type="button"
                className={`dp-side-btn ${productType === "DELIVERY" ? "dp-side-btn--active" : ""}`}
                onClick={() => onProductTypeChange("DELIVERY")}
              >
                Delivery
              </button>
              <button
                type="button"
                className={`dp-side-btn ${productType === "INTRADAY" ? "dp-side-btn--active" : ""}`}
                onClick={() => onProductTypeChange("INTRADAY")}
              >
                Intraday
              </button>
            </div>
            <p className="trade-terminal-field-hint">
              {productType === "INTRADAY"
                ? "Intraday positions are auto square-off candidates after market close."
                : "Delivery positions can carry forward beyond the session."}
            </p>
          </>
        ) : (
          <p className="trade-terminal-field-hint trade-terminal-kicker--spaced">
            Sell exits use the product type of the existing position.
          </p>
        )}
      </div>

      <p className="trade-terminal-kicker trade-terminal-kicker--spaced">{execKicker}</p>
      <div className="trade-terminal-entry-grid">
        <div className="dp-field-group">
          <label className="dp-label">
            Limit price (₹)
            {livePriceHint ? <span className="dp-label__live">{livePriceHint}</span> : null}
          </label>
          <input
            type="number"
            className="dp-input trade-terminal-mono"
            value={price}
            onChange={(e) => onPriceChange(e.target.value)}
            placeholder="0.00"
            step="0.01"
            min="0"
          />
        </div>
        <div className="dp-field-group">
          <label className="dp-label">Quantity</label>
          {quantitySystemHint ? (
            <p className="trade-terminal-field-hint trade-terminal-field-hint--system">{quantitySystemHint}</p>
          ) : null}
          <input
            type="number"
            className="dp-input trade-terminal-mono"
            value={quantity}
            onChange={(e) => onQuantityChange(e.target.value)}
            placeholder="1"
            min="1"
            step="1"
          />
        </div>
      </div>

      <p className="trade-terminal-kicker trade-terminal-kicker--spaced">{riskKicker}</p>
      <div className="trade-terminal-risk-group">
        {side === "BUY" ? (
          <>
            <div className="dp-field-row">
              <div className="dp-field-group dp-field-group--half">
                <label className="dp-label">Stop loss (₹) — required</label>
                {stopSystemNote ? (
                  <p className="trade-terminal-field-hint trade-terminal-field-hint--system">{stopSystemNote}</p>
                ) : null}
                <input
                  type="number"
                  className="dp-input dp-input--danger trade-terminal-mono"
                  value={stopLoss}
                  onChange={(e) => onStopLossChange(e.target.value)}
                  placeholder="Below entry"
                  step="0.01"
                  min="0"
                />
              </div>
              <div className="dp-field-group dp-field-group--half">
                <label className="dp-label">Target (₹)</label>
                <input
                  type="number"
                  className="dp-input dp-input--success trade-terminal-mono"
                  value={target}
                  onChange={(e) => onTargetChange(e.target.value)}
                  placeholder="Above entry"
                  step="0.01"
                  min="0"
                />
              </div>
            </div>
            <p className="trade-terminal-field-hint">Required for buy trades.</p>
            {showRr && rr != null && Number.isFinite(rr) ? (
              <p className="trade-terminal-rr">
                <span className="trade-terminal-rr__label">R:R estimate</span>
                <span className="trade-terminal-rr__value">{rr.toFixed(2)}:1</span>
              </p>
            ) : null}
          </>
        ) : (
          <p className="trade-terminal-note trade-terminal-note--muted">
            Sells are sized with limit price and quantity. Stop and target apply on the buy side.
          </p>
        )}
      </div>
    </div>
  );
}
