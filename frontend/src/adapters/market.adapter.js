const toArray = (value) => (Array.isArray(value) ? value : []);

export const normalizeMarketIndices = (response) => {
  const payload = response?.data ?? response ?? {};
  const indices = toArray(payload?.data?.indices ?? payload?.indices);
  return {
    indices,
    degraded: Boolean(payload?.degraded),
  };
};

export const normalizeExplorerPayload = (response) => {
  const payload = response?.data ?? response ?? {};
  return {
    stocks: toArray(payload?.stocks),
    meta: payload?.meta ?? { isSynthetic: false, isFallback: false },
  };
};

export const normalizeIntelligencePayload = (response) => {
  const payload = response?.data ?? response ?? {};
  const data = payload?.data ?? {};
  return {
    state: data?.state ?? payload?.state ?? "EMPTY",
    status: data?.status ?? payload?.status ?? "UNAVAILABLE",
    signals: toArray(data?.signals ?? payload?.signals),
  };
};

export const normalizeHistoryPayload = (response) => {
  const payload = response?.data ?? response ?? {};
  return {
    prices: toArray(payload?.data?.prices ?? payload?.prices),
    isFallback: Boolean(payload?.data?.isFallback ?? payload?.isFallback),
  };
};
