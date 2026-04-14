import React from "react";
import { JournalList } from "./JournalList";
import { useJournalSummary } from "../../hooks/useJournal";

export const JournalPage: React.FC = () => {
  const { data, isLoading, isError, error } = useJournalSummary();

  if (isLoading) {
    return <div className="journal-loading">Retrieving reflection data...</div>;
  }

  if (isError) {
    return (
      <div className="journal-error">
        <h3>Communication Failure</h3>
        <p>{error?.message || "Failed to sync trading journal."}</p>
      </div>
    );
  }

  return (
    <div className="journal-page">
      <h1>Learning Journal</h1>
      <p className="description">
        Systematic audit of execution protocol vs. behavioral outcomes.
      </p>

      {data?.success && (
        <JournalList entries={data.data.entries} />
      )}
    </div>
  );
};
