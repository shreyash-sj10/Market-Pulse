import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { setTradeFlowNavigate } from "../v2/trade-flow";

export default function TradeFlowNavigateBinder() {
  const navigate = useNavigate();
  useEffect(() => {
    setTradeFlowNavigate(navigate);
    return () => setTradeFlowNavigate(null);
  }, [navigate]);
  return null;
}
