import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useSocketContext } from "../context/SocketContext.tsx";
import { queryKeys } from "../lib/queryKeys.ts";
import type { PortfolioSummary, Position, SystemHealth } from "@shared/types.ts";

// ===================================================================
// socket.io hadisələrini TanStack Query cache-inə bağlayır (plan:
// "socket.io hadisələri queryClient.setQueryData ilə eyni cache-ə
// yazılır"). Snapshot hadisələr (portfolio/position/health) birbaşa
// cache-i yeniləyir; tək-obyekt hadisələr (trade:closed, signal:new)
// siyahı sorğularını invalidasiya edir (tam siyahı deyil, tək element gəlir).
// ===================================================================

interface EngineStatePayload {
  engineState: "running" | "paused";
  stateChangedAt: number;
}

export function useSocket(): { connected: boolean } {
  const { socket, connected } = useSocketContext();
  const queryClient = useQueryClient();

  useEffect(() => {
    const onPortfolio = (payload: PortfolioSummary) => {
      queryClient.setQueryData(queryKeys.portfolio, payload);
    };
    const onPositions = (payload: Position[]) => {
      queryClient.setQueryData(queryKeys.positions, payload);
    };
    const onHealth = (payload: SystemHealth) => {
      queryClient.setQueryData(queryKeys.health, payload);
    };
    const onEngineState = (payload: EngineStatePayload) => {
      queryClient.setQueryData<SystemHealth>(queryKeys.health, (old) =>
        old ? { ...old, engineState: payload.engineState, stateChangedAt: payload.stateChangedAt } : old,
      );
    };
    const onTradeClosed = () => {
      void queryClient.invalidateQueries({ queryKey: ["trades"] });
      void queryClient.invalidateQueries({ queryKey: ["equityCurve"] });
      void queryClient.invalidateQueries({ queryKey: ["metrics"] });
    };
    const onSignalNew = () => {
      void queryClient.invalidateQueries({ queryKey: ["signals"] });
    };

    socket.on("portfolio:update", onPortfolio);
    socket.on("position:update", onPositions);
    socket.on("health:update", onHealth);
    socket.on("engine:state", onEngineState);
    socket.on("trade:closed", onTradeClosed);
    socket.on("signal:new", onSignalNew);

    return () => {
      socket.off("portfolio:update", onPortfolio);
      socket.off("position:update", onPositions);
      socket.off("health:update", onHealth);
      socket.off("engine:state", onEngineState);
      socket.off("trade:closed", onTradeClosed);
      socket.off("signal:new", onSignalNew);
    };
  }, [socket, queryClient]);

  return { connected };
}
