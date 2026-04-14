import { api } from "./api";
import type { JournalSummary } from "../contracts/journal";

export const journalService = {
  getSummary: async () => {
    const response = await api.get<{ success: boolean; data: JournalSummary; state: string }>(
      "/journal/summary"
    );
    return response.data;
  },
};
