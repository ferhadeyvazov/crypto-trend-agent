import type { Position as InternalPosition, TradeRecord } from "../../execution/types.js";
import type { ExecutionEngine } from "../../execution/ExecutionEngine.js";
import type { EquityPoint as InternalEquityPoint } from "../../reporting/types.js";
import type { LogEvent } from "../../logging/index.js";
import type { HealthTracker } from "../../health/HealthTracker.js";
import type {
  Position as ApiPosition,
  Trade as ApiTrade,
  Signal as ApiSignal,
  EquityPoint as ApiEquityPoint,
  SystemHealth as ApiSystemHealth,
} from "../../../shared/types.js";

// ===================================================================
// Daxili mühərrik tipləri → dashboard API kontraktı (shared/types.ts)
// çevirmələri. Xalis funksiyalar — heç bir I/O aparmır (fayl/şəbəkə
// oxuyucuları ayrı modullardadır: readTrades.ts, readSignalEvents.ts).
// ===================================================================

/**
 * YALNIZ fill olmuş (entryPrice/entryTime dolu) pozisiyalar üçün çağırılmalıdır —
 * PENDING_ENTRY (hələ fill olmayıb) `/api/positions`-də göstərilmir.
 * `currentPrice` yoxdursa (DataLayer keşi hələ boşdursa) unrealizedPnl 0 qaytarılır.
 */
export function toApiPosition(position: InternalPosition, currentPrice: number | null): ApiPosition {
  const entryPrice = position.entryPrice!;
  const unrealizedPnl =
    currentPrice === null
      ? 0
      : (position.direction === "LONG" ? currentPrice - entryPrice : entryPrice - currentPrice) *
        position.remainingSize;

  return {
    id: position.symbol,
    symbol: position.symbol,
    side: position.direction === "LONG" ? "long" : "short",
    entryPrice,
    size: position.remainingSize,
    stopLoss: position.stop,
    takeProfit: position.tp1Price,
    openedAt: position.entryTime!,
    unrealizedPnl,
  };
}

export function toApiTrade(trade: TradeRecord): ApiTrade {
  return {
    id: trade.id,
    symbol: trade.symbol,
    side: trade.side === "LONG" ? "long" : "short",
    entryPrice: trade.entryPrice,
    size: trade.size,
    stopLoss: trade.stopPrice,
    takeProfit: trade.tp1Price,
    openedAt: trade.entryTime,
    exitPrice: trade.exitPrice,
    closedAt: trade.exitTime,
    realizedPnl: trade.netPnl,
    ruleCode: `${trade.signalType}_${trade.exitReason}`,
    exitReason: trade.exitReason,
  };
}

/** `readSignalEvents`-in tapdığı SIGNAL-level log sətirlərindən yalnız HƏQİQİ siqnalları (rədd/"siqnal yoxdur" yox) çevirir. */
export function toApiSignal(event: LogEvent): ApiSignal | null {
  const data = event.data;
  if (!data || typeof data.symbol !== "string" || typeof data.type !== "string") return null;
  const timeframe = data.timeframe === "4H" ? "4H" : "1H";
  return {
    symbol: data.symbol,
    timeframe,
    type: data.type,
    createdAt: event.ts,
  };
}

export function toApiEquityPoint(point: InternalEquityPoint): ApiEquityPoint {
  return { timestamp: point.time, equity: point.equity };
}

export function toApiSystemHealth(
  executionEngine: Pick<ExecutionEngine, "isEntriesPaused" | "getEngineStateLog">,
  healthTracker: HealthTracker,
  nowMs: number,
): ApiSystemHealth {
  const stateLog = executionEngine.getEngineStateLog();
  const lastEntry = stateLog[stateLog.length - 1];

  return {
    schedulerStatus: healthTracker.getSchedulerStatus(nowMs),
    engineState: executionEngine.isEntriesPaused() ? "paused" : "running",
    stateChangedAt: lastEntry?.changedAt ?? 0,
    lastFetchAt: healthTracker.getLastCycleCompletedAt() ?? 0,
    recentErrors: healthTracker.getRecentErrorMessages(),
    stateLog: stateLog.map((e) => ({
      state: e.paused ? "paused" : "running",
      changedAt: e.changedAt,
      reason: e.reason,
    })),
    recentEvents: healthTracker.getRecentEvents(),
  };
}
