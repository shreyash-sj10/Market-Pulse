import type { RiskValidatorProps } from "./RiskValidator";

type GateProps = Omit<RiskValidatorProps, "mode" | "snapshot" | "authorityVerdict" | "analyzing">;

/** True when local checks contain a hard block (Analyze stays disabled). */
export function hasBlockingLocalIssues(props: GateProps): boolean {
  const qty = parseInt(props.quantity || "0", 10);
  const ep = parseFloat(props.price || "0");
  const sl = parseFloat(props.stopLoss || "0");
  const tp = parseFloat(props.target || "0");

  if (qty <= 0 || ep <= 0) return true;
  if (props.scalingBlocked && qty > 1) return true;
  if (props.thesis.trim().length < props.thesisMin) return true;
  if (!props.preTradeEmotion || !String(props.preTradeEmotion).trim()) return true;
  if (props.side === "BUY") {
    if (sl <= 0 || tp <= 0) return true;
    if (sl >= ep || tp <= ep) return true;
  }
  return false;
}
