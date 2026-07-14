import { useQuery } from "@tanstack/react-query";
import { getEquityCurve } from "../api/client.ts";
import { queryKeys } from "../lib/queryKeys.ts";

export function useEquityCurve(params: { from?: number; to?: number } = {}) {
  return useQuery({ queryKey: queryKeys.equityCurve(params), queryFn: () => getEquityCurve(params) });
}
