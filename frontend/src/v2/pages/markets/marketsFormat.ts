import { fromPaise } from "../../../utils/currency.utils";

export function formatMarketPrice(pricePaise: number, isFallback?: boolean): string {
  const prefix = isFallback ? "~" : "";
  return `${prefix}₹${fromPaise(pricePaise).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function formatMarketVolume(v?: number): string {
  if (!v) return "—";
  if (v >= 1e7) return `${(v / 1e7).toFixed(1)}Cr`;
  if (v >= 1e5) return `${(v / 1e5).toFixed(1)}L`;
  if (v >= 1e3) return `${(v / 1e3).toFixed(1)}K`;
  return String(v);
}

export function formatMarketMktCap(mc: number | null): string {
  if (mc == null) return "—";
  if (mc >= 1e12) return `₹${(mc / 1e12).toFixed(1)}T`;
  if (mc >= 1e9) return `₹${(mc / 1e9).toFixed(1)}B`;
  if (mc >= 1e6) return `₹${(mc / 1e6).toFixed(1)}M`;
  return `₹${mc.toFixed(0)}`;
}

export function marketExchangeLabel(fullSymbol: string): string {
  if (fullSymbol?.endsWith(".BO")) return "BSE";
  if (fullSymbol?.endsWith(".NS")) return "NSE";
  return "INTL";
}
