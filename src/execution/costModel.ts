import type { StrategyConfig } from "../config/index.js";
import type { SignalDirection } from "../signals/types.js";

// ===================================================================
// Xərc modeli (sənəd, bölmə 10.2). "Xərcsiz simulyasiya ETİBARSIZDIR"
// (dizayn qaydası 5) — hər fill-ə komissiya və slippage tətbiq olunur.
// ===================================================================

/** Komissiya: notional-ın feePctPerSide faizi, hər tərəf (giriş VƏ çıxış) üçün ayrıca çağırılır. */
export function computeCommission(notional: number, config: StrategyConfig): number {
  return notional * (config.paperTrading.feePctPerSide / 100);
}

/**
 * Slippage faizi (0-1 fraksiya): baza + likvidlik-təsirli əlavə.
 * Düstur: 0.05% + 0.02% × (orderNotional / (1% × bar dollar həcmi)), minimum 0.05%.
 * barDollarVolumeUsd <= 0 olanda (məlumat yoxdursa) yalnız baza dəyər istifadə olunur.
 */
export function computeSlippagePct(
  orderNotional: number,
  barDollarVolumeUsd: number,
  config: StrategyConfig,
): number {
  const basePct = config.paperTrading.slippage.basePct / 100;
  if (barDollarVolumeUsd <= 0) return basePct;
  const impact = 0.0002 * (orderNotional / (0.01 * barDollarVolumeUsd));
  return Math.max(basePct, basePct + impact);
}

/**
 * Slippage-i qiymətə mənfi (əleyhinə) istiqamətdə tətbiq edir.
 * LONG giriş / SHORT çıxış = ALIŞ (qiymət yuxarı sürüşür).
 * SHORT giriş / LONG çıxış = SATIŞ (qiymət aşağı sürüşür).
 */
export function applySlippage(
  price: number,
  direction: SignalDirection,
  action: "ENTRY" | "EXIT",
  slippagePct: number,
): number {
  const isBuy = (direction === "LONG" && action === "ENTRY") || (direction === "SHORT" && action === "EXIT");
  return isBuy ? price * (1 + slippagePct) : price * (1 - slippagePct);
}
