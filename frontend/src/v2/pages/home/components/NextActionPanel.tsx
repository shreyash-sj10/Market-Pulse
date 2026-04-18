import { useNavigate } from "react-router-dom";
import type { NextActionVM } from "../mapHomeViewModel";
import { ROUTES } from "../../../routing/routes";

type NextActionPanelProps = {
  model: NextActionVM;
  onReview: () => void;
};

export default function NextActionPanel({ model, onReview }: NextActionPanelProps) {
  const navigate = useNavigate();

  if (model.variant === "loading") {
    return (
      <section className="home-next" aria-busy="true">
        <p className="home-next__headline">Loading next step…</p>
        <p className="home-next__sub">Syncing portfolio and attention queue.</p>
      </section>
    );
  }

  if (model.variant === "first_trade") {
    return (
      <section className="home-next">
        <p className="home-next__headline">{model.headline}</p>
        <p className="home-next__sub">{model.sub}</p>
        <button
          type="button"
          className="home-next__cta"
          onClick={() => navigate(ROUTES.markets)}
        >
          Explore Markets
        </button>
      </section>
    );
  }

  if (model.variant === "review_attention") {
    return (
      <section className="home-next home-next--priority">
        <p className="home-next__headline">{model.headline}</p>
        <p className="home-next__sub">{model.sub}</p>
        <button type="button" className="home-next__cta" onClick={onReview}>
          Review Now
        </button>
      </section>
    );
  }

  return (
    <section className="home-next">
      <p className="home-next__headline">{model.headline}</p>
      <p className="home-next__sub">{model.sub}</p>
    </section>
  );
}
