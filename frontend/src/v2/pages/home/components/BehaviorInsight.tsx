import type { BehaviorInsightVM } from "../mapHomeViewModel";

type BehaviorInsightProps = {
  model: BehaviorInsightVM;
  acknowledged: boolean;
  onAcknowledge: () => void;
};

export default function BehaviorInsight({
  model,
  acknowledged,
  onAcknowledge,
}: BehaviorInsightProps) {
  if (acknowledged) {
    return (
      <div className="home-behavior">
        <p className="home-behavior__note">Note dismissed for this session.</p>
      </div>
    );
  }

  if (model.kind === "empty") {
    return (
      <div className="home-behavior">
        <p className="home-behavior__empty">{model.message}</p>
      </div>
    );
  }

  return (
    <div className="home-behavior">
      <p className="home-behavior__label">Focus</p>
      <p className="home-behavior__mistake">{model.mistake}</p>
      <p className="home-behavior__label home-behavior__label--sub">Correction</p>
      <p className="home-behavior__correction">{model.correction}</p>
      <button type="button" className="home-behavior__ack" onClick={onAcknowledge}>
        Acknowledge
      </button>
    </div>
  );
}
