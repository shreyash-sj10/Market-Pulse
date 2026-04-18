type PositionRowProps = {
  symbol: string;
  entryDisplay: string;
  statusLabel: string;
  pnlPctDisplay: string;
  onReview: () => void;
};

export default function PositionRow({
  symbol,
  entryDisplay,
  statusLabel,
  pnlPctDisplay,
  onReview,
}: PositionRowProps) {
  return (
    <div className="home-pos-row">
      <span className="home-pos-row__sym">{symbol}</span>
      <span className="home-pos-row__entry">{entryDisplay}</span>
      <span className="home-pos-row__status">{statusLabel}</span>
      <span className="home-pos-row__pnl">{pnlPctDisplay}</span>
      <button type="button" className="home-pos-row__cta" onClick={onReview}>
        Review
      </button>
    </div>
  );
}
