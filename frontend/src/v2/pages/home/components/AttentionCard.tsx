import type { Decision } from "../../../domain/decision/buildDecision";

export type HomeAttentionCardProps = {
  tag: Decision["action"];
  symbol: string;
  reason: string;
  confidence: number;
  ctaLabel: string;
  onAction: () => void;
};

export default function AttentionCard({
  tag,
  symbol,
  reason,
  confidence,
  ctaLabel,
  onAction,
}: HomeAttentionCardProps) {
  const reasonShort =
    reason.length > 160 ? `${reason.slice(0, 157).trim()}…` : reason;

  return (
    <article className={`home-attn-card home-attn-card--${tag.toLowerCase()}`}>
      <div className="home-attn-card__top">
        <span className="home-attn-card__tag">{tag}</span>
        <span className="home-attn-card__sym">{symbol}</span>
        <span className="home-attn-card__conf">{confidence}%</span>
      </div>
      <p className="home-attn-card__reason">{reasonShort}</p>
      <button type="button" className="home-attn-card__cta" onClick={onAction}>
        {ctaLabel}
      </button>
    </article>
  );
}
