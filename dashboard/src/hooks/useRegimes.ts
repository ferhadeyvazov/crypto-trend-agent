import { useQuery } from "@tanstack/react-query";
import { getRegimes } from "../api/client.ts";
import { queryKeys } from "../lib/queryKeys.ts";

/** Socket hadisəsi yoxdur (Mərhələ 7 qərarı) — 60 saniyədə bir REST poll ilə "canlı" hiss olunur. */
export function useRegimes() {
  return useQuery({ queryKey: queryKeys.regimes, queryFn: getRegimes, refetchInterval: 60_000 });
}
