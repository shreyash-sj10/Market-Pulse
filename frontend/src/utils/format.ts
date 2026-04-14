export const formatPaise = (paise: number) => {
  return (paise / 100).toLocaleString("en-IN", {
    style: "currency",
    currency: "INR",
  });
};

export const formatPct = (pct: number) => {
  return `${pct > 0 ? "+" : ""}${pct.toFixed(2)}%`;
};
