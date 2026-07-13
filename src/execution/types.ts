import type { SignalDirection, EntrySignalType, Regime } from "../signals/types.js";

// ===================================================================
// ExecutionEngine tipləri (sənəd, bölmə 6, 9, 10).
// Per-asset pozisiya state machine: FLAT → PENDING_ENTRY → OPEN_FULL →
// OPEN_RUNNER (TP1-dən sonra) → FLAT.
// ===================================================================

export type PositionState = "PENDING_ENTRY" | "OPEN_FULL" | "OPEN_RUNNER";

export type ExitReason =
  | "X1_INITIAL_STOP"
  | "X2_TP1" // yalnız partial close-un öz jurnal sətri olmadığı halda (aşağıya bax) tam bağlanış səbəbi kimi görünmür
  | "X3_TRAILING_STOP"
  | "X4_REGIME_FLIP"
  | "X5_TIME_STOP"
  | "MANUAL_CLOSE";

/** Daxili, yaddaşda saxlanılan pozisiya vəziyyəti. */
export interface Position {
  symbol: string;
  direction: SignalDirection;
  state: PositionState;
  signalType: EntrySignalType;

  /** İlkin sifariş ölçüsü (RiskManager-dən) */
  originalSize: number;
  /** Hazırda açıq qalan ölçü (TP1-dən sonra ~50%) */
  remainingSize: number;

  entryTime: number | null;
  entryPrice: number | null;
  /** Siqnal barındakı ATR14(1h) — X1/X2 düsturları bunun üzərində qurulub ("ATR is the value at entry") */
  atr1hAtEntry: number;
  regime4hAtEntry: Regime;
  adx4hAtEntry: number;

  /** İlkin stop (X1) — dəyişmir, R-multiple hesablamasında istifadə olunur */
  initialStop: number;
  /** Cari stop (TP1-dən sonra breakeven-ə, sonra chandelier-ə keçir) */
  stop: number;
  tp1Price: number;
  tp1Filled: boolean;

  /** Chandelier trailing üçün: LONG-da ən yüksək high, SHORT-da ən aşağı low (entry-dən bəri) */
  extremeSinceEntry: number;
  barsSinceEntry: number;

  /** Qismən bağlanışlardan (TP1) yığılan realizasiya olunmuş nəticələr — tam bağlananda jurnala yazılır */
  realizedGrossPnl: number;
  realizedFees: number;
  realizedSlippageCost: number;
  lastExitTime: number;
  lastExitPrice: number;
  lastExitReason: ExitReason;
}

/** Bölmə 10.4: append-only trade jurnalı sətri. */
export interface TradeRecord {
  id: string;
  symbol: string;
  side: SignalDirection;
  signalType: EntrySignalType;
  entryTime: number;
  entryPrice: number;
  stopPrice: number;
  tp1Price: number;
  size: number;
  exitTime: number;
  exitPrice: number;
  exitReason: ExitReason;
  grossPnl: number;
  fees: number;
  slippage: number;
  netPnl: number;
  rMultiple: number;
  equityAfter: number;
  regime4h: Regime;
  adx4h: number;
  atr1h: number;
}
