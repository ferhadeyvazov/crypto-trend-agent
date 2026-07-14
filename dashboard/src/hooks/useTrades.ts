import { useQuery } from "@tanstack/react-query";
import { getTrades } from "../api/client.ts";
import { queryKeys } from "../lib/queryKeys.ts";

export function useTrades(params: { limit?: number; symbol?: string } = {}) {
  return useQuery({ queryKey: queryKeys.trades(params), queryFn: () => getTrades(params) });
}
