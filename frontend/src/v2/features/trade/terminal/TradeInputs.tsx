import TradeForm, { type TradeFormProps } from "./TradeForm";

export type TradeInputsProps = TradeFormProps;

export default function TradeInputs(props: TradeInputsProps) {
  return <TradeForm {...props} />;
}
