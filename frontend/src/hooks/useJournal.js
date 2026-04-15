import { useQuery } from "@tanstack/react-query";
import { getJournalSummary } from "../services/journal.api";
import { queryKeys } from "../constants/queryKeys";
import { safeArray } from "../utils/contract";

export function useJournal() {
  const journalQuery = useQuery({
    queryKey: queryKeys.journalSummary(),
    queryFn: getJournalSummary,
  });

  const journal = journalQuery.data?.data || {
    entries: [],
    frequentPatterns: [],
    totalClosed: 0,
  };

  return {
    journalPayload: journalQuery.data,
    journal,
    entries: safeArray(journal?.entries),
    frequentPatterns: safeArray(journal?.frequentPatterns),
    isLoading: journalQuery.isLoading,
    isError: journalQuery.isError,
    refetch: journalQuery.refetch,
  };
}
