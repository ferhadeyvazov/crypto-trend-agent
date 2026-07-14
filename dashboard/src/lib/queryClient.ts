import { QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // socket.io hadisələri cache-i canlı saxlayır (bax hooks/useSocket.ts) —
      // aqressiv avtomatik refetch lazım deyil.
      staleTime: 60_000,
      refetchOnWindowFocus: false,
    },
  },
});
