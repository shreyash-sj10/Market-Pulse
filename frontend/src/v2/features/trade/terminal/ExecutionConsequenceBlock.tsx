/** Pre-execute copy: consequences of confirming the ticket (portfolio, journal, profile). */
export default function ExecutionConsequenceBlock() {
  return (
    <div className="trade-terminal-consequence" aria-label="Execution consequences">
      <p className="trade-terminal-consequence__title">This will</p>
      <ul className="trade-terminal-consequence__list">
        <li>Create or adjust your position in this symbol</li>
        <li>Append an entry log to your journal (open leg)</li>
        <li>Update profile and system trace for this decision path</li>
      </ul>
    </div>
  );
}
