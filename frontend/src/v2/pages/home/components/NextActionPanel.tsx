import { useNavigate } from "react-router-dom";
import type { NextActionVM } from "../mapHomeViewModel";
import { ROUTES } from "../../../routing/routes";

type NextActionPanelProps = {
  model: NextActionVM;
  onReview: () => void;
  onPrimaryAction: () => void;
};

export default function NextActionPanel({ model, onReview, onPrimaryAction }: NextActionPanelProps) {
  const navigate = useNavigate();

  if (model.variant === "loading") {
    return (
      <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6" aria-busy="true">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Next action</p>
        <p className="mt-4 text-xl font-semibold tracking-tight text-slate-100 md:text-2xl">{model.headline}</p>
        <p className="mt-2 text-sm leading-relaxed text-slate-300">{model.sub}</p>
        <p className="mt-2 text-sm leading-relaxed text-slate-500">{model.reasoning}</p>
      </section>
    );
  }

  if (model.variant === "review") {
    return (
      <section className="rounded-2xl border border-amber-500/40 bg-amber-500/5 p-6">
        <p className="text-xs font-semibold uppercase tracking-wide text-amber-300">Next action</p>
        <p className="mt-4 text-xl font-semibold tracking-tight text-slate-100 md:text-2xl">{model.headline}</p>
        <p className="mt-2 text-sm leading-relaxed text-slate-200">{model.sub}</p>
        <p className="mt-2 text-sm leading-relaxed text-amber-100/80">{model.reasoning}</p>
        <button
          type="button"
          className="mt-6 min-h-10 rounded-lg bg-amber-400 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-amber-300"
          onClick={onReview}
        >
          {model.ctaLabel}
        </button>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-slate-700 bg-slate-900 p-6">
      <p className="text-xs font-semibold uppercase tracking-wide text-cyan-300">Next action</p>
      <p className="mt-4 text-xl font-semibold tracking-tight text-slate-100 md:text-2xl">{model.headline}</p>
      <p className="mt-2 text-sm leading-relaxed text-slate-300">{model.sub}</p>
      <p className="mt-2 text-sm leading-relaxed text-slate-500">{model.reasoning}</p>
      <button
        type="button"
        className="mt-6 min-h-10 rounded-lg bg-cyan-500 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-cyan-400"
        onClick={() => {
          if (model.variant === "active") {
            onPrimaryAction();
            return;
          }
          navigate(ROUTES.markets);
        }}
      >
        {model.ctaLabel}
      </button>
    </section>
  );
}
