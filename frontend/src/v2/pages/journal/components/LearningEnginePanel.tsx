import type { EngineLinkFocus, LearningEngineModel } from "../journalIntelligence";

function severityLabel(s: LearningEngineModel["recurrenceSeverity"]): string {
  if (s === "high") return "High";
  if (s === "medium") return "Med";
  return "Low";
}

type Props = {
  model: LearningEngineModel;
  activeLink: EngineLinkFocus;
  onSelectLink: (link: EngineLinkFocus) => void;
};

function toggle(link: EngineLinkFocus, active: EngineLinkFocus, onSelectLink: (l: EngineLinkFocus) => void): void {
  onSelectLink(active === link ? null : link);
}

type StripProps = {
  stripKey: Exclude<EngineLinkFocus, null>;
  label: string;
  primary: string;
  metric: string;
  active: boolean;
  onActivate: () => void;
};

function EngineStrip({ stripKey, label, primary, metric, active, onActivate }: StripProps) {
  return (
    <button
      type="button"
      className={`journal-engine-strip${active ? " journal-engine-strip--active" : ""}`}
      aria-pressed={active}
      data-engine-strip={stripKey}
      onClick={onActivate}
    >
      <span className="journal-engine-strip__label">{label}</span>
      <span className="journal-engine-strip__primary">{primary}</span>
      <span className="journal-engine-strip__metric">{metric}</span>
    </button>
  );
}

export default function LearningEnginePanel({ model, activeLink, onSelectLink }: Props) {
  const n = model.windowLogCount;
  const recurrencePrimary = model.recurrenceCount > 0 ? model.recurrenceLabel : "—";
  const recurrenceMetric =
    model.recurrenceCount > 0
      ? `${model.recurrenceCount} of ${n} logs · ${severityLabel(model.recurrenceSeverity)}`
      : "0 logs";
  const biasPrimary = model.biasLabel;
  const biasMetric =
    model.biasLabel !== "—" && model.biasLabel !== "None surfaced"
      ? `${model.biasContributingLogCount} of ${n} logs match`
      : `0 of ${n} logs match`;
  const driftMetric = n > 0 ? `${model.driftViolations} of ${n} logs` : "—";
  const correctionMetric =
    model.correctionRatePct != null ? `${model.correctionReadyLogCount} of ${n} ≥2 steps` : "—";

  return (
    <section className="journal-engine" aria-label="Learning engine">
      <header className="journal-engine__head">
        <h2 className="journal-engine__title">Learning engine</h2>
        <p className="journal-engine__hint">Select a signal to highlight contributing log rows.</p>
      </header>
      <div className="journal-engine__row" role="group">
        <EngineStrip
          stripKey="recurrence"
          label="Critical recurrence"
          primary={recurrencePrimary}
          metric={recurrenceMetric}
          active={activeLink === "recurrence"}
          onActivate={() => toggle("recurrence", activeLink, onSelectLink)}
        />
        <EngineStrip
          stripKey="bias"
          label="Bias detected"
          primary={biasPrimary}
          metric={biasMetric}
          active={activeLink === "bias"}
          onActivate={() => toggle("bias", activeLink, onSelectLink)}
        />
        <EngineStrip
          stripKey="drift"
          label="System drift"
          primary="Non-ACT posture"
          metric={driftMetric}
          active={activeLink === "drift"}
          onActivate={() => toggle("drift", activeLink, onSelectLink)}
        />
        <EngineStrip
          stripKey="correction"
          label="Correction rate"
          primary={model.correctionRatePct != null ? `${model.correctionRatePct}%` : "—"}
          metric={correctionMetric}
          active={activeLink === "correction"}
          onActivate={() => toggle("correction", activeLink, onSelectLink)}
        />
      </div>
    </section>
  );
}
