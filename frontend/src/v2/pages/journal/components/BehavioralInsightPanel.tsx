import type { BehavioralGuidanceModel } from "../journalIntelligence";

type Props = { model: BehavioralGuidanceModel };

export default function BehavioralInsightPanel({ model }: Props) {
  const conf =
    model.patternConfidencePct != null ? `${model.patternConfidencePct}%` : "—";

  return (
    <aside className="journal-behavioral" aria-label="Behavioral intelligence">
      <header className="journal-behavioral__head">
        <h2 className="journal-behavioral__title">Behavioral synthesis</h2>
      </header>

      <dl className="journal-behavioral__grid">
        <div className="journal-behavioral__fact">
          <dt className="journal-behavioral__fact-label">Pattern confidence</dt>
          <dd className="journal-behavioral__fact-value">{conf}</dd>
          <dd className="journal-behavioral__fact-sub">Derived from recurrence mass × bias hit × drift penalty.</dd>
        </div>
        <div className="journal-behavioral__fact">
          <dt className="journal-behavioral__fact-label">Trigger condition</dt>
          <dd className="journal-behavioral__fact-value journal-behavioral__fact-value--wrap">
            {model.triggerCondition}
          </dd>
        </div>
        <div className="journal-behavioral__fact">
          <dt className="journal-behavioral__fact-label">Performance impact</dt>
          <dd className="journal-behavioral__fact-value journal-behavioral__fact-value--wrap">
            {model.performanceImpact}
          </dd>
        </div>
      </dl>

      <p className="journal-behavioral__insight">{model.patternInsight}</p>

      <div className="journal-behavioral__divider" />
      <p className="journal-behavioral__action-label">Operating rule</p>
      <p className="journal-behavioral__action">{model.systemAction}</p>
    </aside>
  );
}
