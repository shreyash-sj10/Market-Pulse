import { useMutation } from "@tanstack/react-query";
import { intelligenceService } from "../services/intelligence.service";

export const usePreTradeAudit = () => {
  return useMutation({
    mutationFn: intelligenceService.getPreTradeAudit,
  });
};
