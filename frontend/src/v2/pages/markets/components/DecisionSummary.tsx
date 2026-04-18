type DecisionSummaryProps = {
  lines: string[];
};

/** Decision context summary — compact, muted; lines from rule/tape mappers only. */
export default function DecisionSummary({ lines }: DecisionSummaryProps) {
  if (!lines.length) return null;
  return (
    <div className="workspace-decision-summary">
      {lines.map((line, i) => (
        <p key={i} className="workspace-decision-summary__line">
          {line}
        </p>
      ))}
    </div>
  );
}
