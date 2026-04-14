import { useQuery } from "@tanstack/react-query";
import { journalService } from "../services/journal.service";

export const useJournalSummary = () => {
  return useQuery({
    queryKey: ["journal"],
    queryFn: journalService.getSummary,
  });
};
