import { useQuery } from "@tanstack/react-query";
import { getMetrics } from "../api/client.ts";
import { queryKeys } from "../lib/queryKeys.ts";

export function useMetrics() {
  return useQuery({ queryKey: queryKeys.metrics, queryFn: getMetrics });
}
