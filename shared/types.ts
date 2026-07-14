// ===================================================================
// Dashboard API kontraktı (TRAIDERIM_V2_PLAN.md, bölmə 5). Bu tiplər
// backend-in daxili mühərrik tipləri (src/execution, src/signals,
// src/reporting) İLƏ EYNİ DEYİL — storage-adapter (Mərhələ 2) daxili
// state-i bu formaya çevirir. Backend daxili tipləri bu fayldan
// import etmir və əksinə.
// ===================================================================

export type PositionSide = "long" | "short";

interface PositionCommon {
  id: string;
  symbol: string;
  side: PositionSide;
  entryPrice: number;
  size: number;
  stopLoss: number;
  takeProfit: number;
  openedAt: number;
}

/** Açıq mövqe (canlı). Mənbə: src/execution/types.ts Position — çevrilir: direction→side (kiçik hərf), remainingSize→size, unrealizedPnl yeni hesablanır. */
export interface Position extends PositionCommon {
  unrealizedPnl: number;
}

/** Bağlanmış treyd. Mənbə: src/execution/types.ts TradeRecord (demək olar 1:1) — exitTime→closedAt, netPnl→realizedPnl; ruleCode daxili kodda yoxdur, storage-adapter signalType+exitReason-dan formalaşdırır. */
export interface Trade extends PositionCommon {
  exitPrice: number;
  closedAt: number;
  realizedPnl: number;
  ruleCode: string;
  exitReason: string;
}

/** Mənbə: src/signals/engine.ts EvaluatedSignal + src/signals/types.ts Regime/SignalDirection — timeframe və createdAt daxili tipdə yoxdur, storage-adapter təyin edir. */
export interface Signal {
  symbol: string;
  timeframe: "4H" | "1H";
  type: string;
  createdAt: number;
}

/** Mənbə: src/reporting/types.ts EquityPoint ({time, equity}) — sahə adı plan bölmə 5-ə uyğun timestamp-a çevrilir. */
export interface EquityPoint {
  timestamp: number;
  equity: number;
}

/**
 * Mənbə: src/execution/systemState.ts SystemState/SystemStateInfo YALNIZ QİSMƏN uyğundur.
 * `engineState` BURADA manual pause-entries flag-idir (Feature 7, hələ backend-də yoxdur,
 * Mərhələ 2-də əlavə olunacaq) — daxili `SystemState` (RUNNING/PAUSED_DAILY/PAUSED_STREAK/HALTED)
 * ilə QARIŞDIRILMAMALIDIR, o AVTOMATİK risk-halt mexanizmidir, ayrı konsepdir.
 * schedulerStatus/lastFetchAt/recentErrors üçün daxili mənbə yoxdur — yeni yaradılacaq.
 */
export interface SystemHealth {
  schedulerStatus: "running" | "stalled";
  engineState: "running" | "paused";
  stateChangedAt: number;
  lastFetchAt: number;
  recentErrors: string[];
}
