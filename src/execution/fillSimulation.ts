import type { Candle } from "../data/types.js";
import type { StrategyConfig } from "../config/index.js";
import type { SignalDirection } from "../signals/types.js";
import { computeSlippagePct, applySlippage } from "./costModel.js";

// ===================================================================
// Fill simulyasiyası (sənəd, bölmə 10.3). ExecutionEngine bu funksiyalara
// yalnız BAĞLANMIŞ şam ötürür — indi bağlanan barın high/low/open-i real
// bazar davranışını təqlid etmək üçün istifadə olunur.
// ===================================================================

export interface FillOutcome {
  type: "STOP" | "TP1" | "NONE";
  price: number;
  slippagePct: number;
}

/** Giriş fill-i: "bar FOLLOWING the signal bar"-ın open-i + slippage. */
export function simulateEntryFill(
  candle: Candle,
  direction: SignalDirection,
  orderNotionalEstimate: number,
  barDollarVolumeUsd: number,
  config: StrategyConfig,
): { price: number; slippagePct: number } {
  const slippagePct = computeSlippagePct(orderNotionalEstimate, barDollarVolumeUsd, config);
  const price = applySlippage(candle.open, direction, "ENTRY", slippagePct);
  return { price, slippagePct };
}

/** Stop fill-i: gap varsa open-dən (slippagesiz), yoxdursa stop qiymətindən + slippage. */
function simulateStopOutcome(
  candle: Candle,
  stopPrice: number,
  direction: SignalDirection,
  orderNotional: number,
  barDollarVolumeUsd: number,
  config: StrategyConfig,
): FillOutcome {
  const gapped = direction === "LONG" ? candle.open < stopPrice : candle.open > stopPrice;
  if (gapped) {
    return { type: "STOP", price: candle.open, slippagePct: 0 };
  }
  const slippagePct = computeSlippagePct(orderNotional, barDollarVolumeUsd, config);
  const price = applySlippage(stopPrice, direction, "EXIT", slippagePct);
  return { type: "STOP", price, slippagePct };
}

/**
 * OPEN_FULL vəziyyətində (stop VƏ TP1 ikisi də "canlı" sifarişdir) bu bar
 * nə baş verdi? Eyni barda ikisi də toxunubsa: STOP_FIRST (mühafizəkar
 * fərziyyə, sənəd bölmə 10.3).
 */
export function resolveOpenFullBarOutcome(
  candle: Candle,
  stopPrice: number,
  tp1Price: number,
  direction: SignalDirection,
  orderNotional: number,
  barDollarVolumeUsd: number,
  config: StrategyConfig,
): FillOutcome {
  const stopTouched = direction === "LONG" ? candle.low <= stopPrice : candle.high >= stopPrice;
  if (stopTouched) {
    return simulateStopOutcome(candle, stopPrice, direction, orderNotional, barDollarVolumeUsd, config);
  }
  const tp1Touched = direction === "LONG" ? candle.high >= tp1Price : candle.low <= tp1Price;
  if (tp1Touched) {
    return { type: "TP1", price: tp1Price, slippagePct: 0 }; // limit order — slippagesiz (sənəd, bölmə 10.3)
  }
  return { type: "NONE", price: NaN, slippagePct: 0 };
}

/** OPEN_RUNNER vəziyyətində (yalnız trailing stop canlıdır, TP1 artıq yoxdur). */
export function resolveOpenRunnerBarOutcome(
  candle: Candle,
  trailingStop: number,
  direction: SignalDirection,
  orderNotional: number,
  barDollarVolumeUsd: number,
  config: StrategyConfig,
): FillOutcome {
  const stopTouched = direction === "LONG" ? candle.low <= trailingStop : candle.high >= trailingStop;
  if (!stopTouched) return { type: "NONE", price: NaN, slippagePct: 0 };
  return simulateStopOutcome(candle, trailingStop, direction, orderNotional, barDollarVolumeUsd, config);
}
