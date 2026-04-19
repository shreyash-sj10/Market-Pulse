/** Must match backend `PRE_TRADE_EMOTION_VALUES`. */
export const PRE_TRADE_EMOTION_OPTIONS = [
  { id: "CALM", label: "Calm / neutral" },
  { id: "CONFIDENT", label: "Confident" },
  { id: "DISCIPLINED", label: "Disciplined / rule-based" },
  { id: "UNCERTAIN", label: "Uncertain" },
  { id: "ANXIOUS", label: "Anxious / tense" },
  { id: "FOMO", label: "FOMO / fear of missing out" },
  { id: "REVENGE", label: "Revenge / need to win back" },
  { id: "EXCITED", label: "Excited / euphoric" },
  { id: "FRUSTRATED", label: "Frustrated / irritated" },
] as const;

export type PreTradeEmotionId = (typeof PRE_TRADE_EMOTION_OPTIONS)[number]["id"];
