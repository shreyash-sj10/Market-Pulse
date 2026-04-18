const asArray = (value) => (Array.isArray(value) ? value : []);

const toTraceListItem = (item) => ({
  id: item?.id ?? item?._id ?? "",
  type: item?.type ?? "UNKNOWN",
  timestamp: item?.timestamp ?? item?.createdAt ?? new Date().toISOString(),
  verdict: item?.verdict ?? null,
  summary: item?.summary ?? "",
});

export const normalizeTraceList = (response) => {
  const payload = response?.data ?? response ?? {};
  const rawList = payload?.data?.list ?? payload?.list ?? [];
  return asArray(rawList).map(toTraceListItem);
};

export const normalizeTraceDetail = (response) => {
  const payload = response?.data ?? response ?? {};
  return payload?.data ?? payload ?? null;
};
