import { useQuery } from "@tanstack/react-query";
import { getPortfolio } from "../api/client.ts";
import { queryKeys } from "../lib/queryKeys.ts";

export function usePortfolio() {
  return useQuery({ queryKey: queryKeys.portfolio, queryFn: getPortfolio });
}
