import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import api from "../services/api";
import { queryKeys } from "../constants/queryKeys";
import { normalizeTraceDetail, normalizeTraceList } from "../adapters/trace.adapter";

export function useTrace() {
  const [selectedTraceId, setSelectedTraceId] = useState(null);

  const listQuery = useQuery({
    queryKey: queryKeys.traceList(),
    queryFn: async () => {
      const response = await api.get("/trace");
      return normalizeTraceList(response?.data);
    },
  });

  const detailQuery = useQuery({
    queryKey: queryKeys.traceDetail(selectedTraceId),
    queryFn: async () => {
      const response = await api.get(`/trace/${selectedTraceId}`);
      return normalizeTraceDetail(response?.data);
    },
    enabled: Boolean(selectedTraceId),
  });

  return {
    traces: listQuery.data || [],
    selectedTraceId,
    selectedTrace: detailQuery.data,
    listLoading: listQuery.isLoading,
    detailLoading: detailQuery.isLoading,
    selectTrace: setSelectedTraceId,
  };
}
