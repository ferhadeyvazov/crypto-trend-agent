import { useQuery } from "@tanstack/react-query";
import { getSignals } from "../api/client.ts";
import { queryKeys } from "../lib/queryKeys.ts";

export function useSignals(params: { limit?: number } = {}) {
  return useQuery({ queryKey: queryKeys.signals(params), queryFn: () => getSignals(params) });
}
