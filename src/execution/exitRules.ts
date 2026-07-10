import type { StrategyConfig } from "../config/index.js";
import type { Regime, SignalDirection } from "../signals/types.js";

// ===================================================================
// Çıxış qaydaları (sənəd, bölmə 6: X1-X5).
// Xalis funksiyalar — ExecutionEngine bunları hər bar bağlananda çağırır.
// ===================================================================

/** X1: ilkin stop-loss. "ATR is the value at entry" — signal barının ATR-i istifadə olunur. */
export function computeInitialStop(
  entryPrice: number,
  atr1hAtEntry: number,
  direction: SignalDirection,
  config: StrategyConfig,
): number {
  const dist = config.exit.stopAtrMult * atr1hAtEntry;
  return direction === "LONG" ? entryPrice - dist : entryPrice + dist;
}

/** X2: qismən TP (+1R). */
export function computeTp1(
  entryPrice: number,
  atr1hAtEntry: number,
  direction: SignalDirection,
  config: StrategyConfig,
): number {
  const dist = config.exit.tp1AtrMult * atr1hAtEntry;
  return direction === "LONG" ? entryPrice + dist : entryPrice - dist;
}

/**
 * X3: Chandelier trailing (yalnız TP1-dən sonra qalan hissə üçün).
 * TS = extremeSinceEntry ∓ trailingAtrMult×ATR(cari). Stop YALNIZ əlverişli
 * istiqamətdə hərəkət edir (LONG-da yuxarı, SHORT-da aşağı) — heç vaxt geri getmir.
 */
export function updateChandelierStop(
  currentStop: number,
  extremeSinceEntry: number,
  atr1hCurrent: number,
  direction: SignalDirection,
  config: StrategyConfig,
): number {
  const dist = config.exit.trailingAtrMult * atr1hCurrent;
  const candidate = direction === "LONG" ? extremeSinceEntry - dist : extremeSinceEntry + dist;
  return direction === "LONG" ? Math.max(currentStop, candidate) : Math.min(currentStop, candidate);
}

/**
 * X4: rejim əks istiqamətə "dönübsə" bağla. NO_TRADE bura daxil deyil —
 * sənəd (bölmə 4 qeydi, R4.3) deyir: NO_TRADE-də mövcud pozisiyalar
 * DƏRHAL bağlanmır, öz çıxış qaydaları ilə idarə olunmaqda davam edir.
 */
export function isRegimeFlipped(direction: SignalDirection, currentRegime4h: Regime): boolean {
  return (direction === "LONG" && currentRegime4h === "SHORT_ONLY")
    || (direction === "SHORT" && currentRegime4h === "LONG_ONLY");
}

/** X5: TP1-ə çatmadan timeStopBars1h (72) bar keçibsə bağla. Yalnız hələ OPEN_FULL olan pozisiyalara aiddir. */
export function isTimeStopHit(barsSinceEntry: number, config: StrategyConfig): boolean {
  return barsSinceEntry >= config.exit.timeStopBars1h;
}
