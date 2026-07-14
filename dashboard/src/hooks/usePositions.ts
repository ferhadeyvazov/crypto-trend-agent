import { useQuery } from "@tanstack/react-query";
import { getPositions } from "../api/client.ts";
import { queryKeys } from "../lib/queryKeys.ts";

export function usePositions() {
  return useQuery({ queryKey: queryKeys.positions, queryFn: getPositions });
}
