import React from "react";
import { JournalCard } from "./JournalCard";
import { JournalEmpty } from "./JournalEmpty";
import type { JournalEntry } from "../../contracts/journal";

interface JournalListProps {
  entries: JournalEntry[];
}

export const JournalList: React.FC<JournalListProps> = ({ entries }) => {
  if (entries.length === 0) {
    return <JournalEmpty />;
  }

  return (
    <div className="journal-list">
      {entries.map((entry, index) => (
        <JournalCard 
          key={`${entry.symbol}-${entry.openedAt}-${index}`} 
          symbol={entry.symbol} 
          learning={entry.learningSurface} 
        />
      ))}
    </div>
  );
};
