import type { StrategyConfig } from "../config/index.js";
import type { SizingResult } from "./types.js";

// ===================================================================
// Pozisiya ölçüləndirmə (sənəd, bölmə 7).
// Sadə dildə: "bu trade-də nə qədər itirməyə razıyam?" (equity-nin
// riskPerTrade faizi) sualından geriyə gedib, neçə ədəd (positionSize)
// almalı olduğumu tapıram. Stop məsafəsi genişdirsə ölçü kiçilir —
// beləliklə hər trade-in itki riski EYNİ (riskPerTrade) qalır.
//
// İnterpretasiya qeydi: sənəd "notional <= equity*0.20" şərtini "Constraint"
// kimi yazır, əməliyyatı açıq demir. Trade-i tam ləğv etmək əvəzinə ölçünü
// 20%-lik tavana qədər KİÇİLDİRİK (real risk riskPerTrade-dən az olur —
// mühafizəkar nəticə, F5/notional pozuntusu yaratmır).
// ===================================================================

export function computePositionSize(
  equity: number,
  entryPrice: number,
  stopPrice: number,
  minNotional: number,
  config: StrategyConfig,
): SizingResult {
  const riskAmount = equity * config.risk.riskPerTrade;
  const stopDistance = Math.abs(entryPrice - stopPrice);

  if (stopDistance <= 0) {
    return { positionSize: 0, notional: 0, riskAmount, stopDistance, skipped: "INVALID_STOP_DISTANCE" };
  }

  let positionSize = riskAmount / stopDistance;
  let notional = positionSize * entryPrice;

  const maxNotional = equity * (config.risk.maxNotionalPctPerPosition / 100);
  if (notional > maxNotional) {
    positionSize = maxNotional / entryPrice;
    notional = maxNotional;
  }

  if (notional < minNotional) {
    return { positionSize: 0, notional: 0, riskAmount, stopDistance, skipped: "BELOW_MIN_NOTIONAL" };
  }

  return { positionSize, notional, riskAmount, stopDistance, skipped: null };
}
