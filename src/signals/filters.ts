import type { Candle } from "../data/types.js";
import { atr, sma } from "../indicators/index.js";
import type { StrategyConfig } from "../config/index.js";
import type { FilterContext, FilterResult } from "./types.js";

// ===================================================================
// Universal giriş filtrləri F1–F4 (sənəd, bölmə 5.3).
// F5 (bölmə 8, portfel limitləri) BURAYA DAXIL DEYİL — bölmə 9-un
// pseudokodunda ayrıca `portfolioLimitsOk()` addımı kimi göstərilib,
// bunu RiskManager (Mərhələ 4) tətbiq edəcək.
// ===================================================================

export function checkFilters(
  candles1h: Candle[],
  context: FilterContext,
  config: StrategyConfig,
): FilterResult {
  const failed: string[] = [];
  const i = candles1h.length - 1;

  // F1 — Volatillik: ATR14 ≥ 0.7 × SMA(ATR14, 50). Ölü bazarda giriş yoxdur.
  // Qeyd: sma() ATR-in NaN-lı isinmə prefiksini "zəhərləyər" (kumulyativ cəm
  // NaN-dan sonra bərpa olunmur) — macd.ts-dəki kimi yalnız etibarlı hissəni veririk.
  const atr14 = atr(candles1h, config.indicators.atr_1h.period);
  const firstValidAtr = atr14.findIndex((v) => !Number.isNaN(v));
  const atrAvg =
    firstValidAtr >= 0 ? sma(atr14.slice(firstValidAtr), config.indicators.atr_1h.avgPeriod) : [];
  const a14 = atr14[i]!;
  const aAvg = firstValidAtr >= 0 && i - firstValidAtr >= 0 ? atrAvg[i - firstValidAtr]! : NaN;
  if (Number.isNaN(a14) || Number.isNaN(aAvg)) {
    failed.push("F1_INSUFFICIENT_DATA");
  } else if (a14 < config.indicators.atr_1h.minRatio * aAvg) {
    failed.push("F1_LOW_VOLATILITY");
  }

  // F2 — Spread: geniş spread-li aktivlərə giriş yoxdur
  if (context.spreadBps > config.entry.maxSpreadBps) {
    failed.push("F2_WIDE_SPREAD");
  }

  // F3 — Pozisiya unikallığı: eyni aktivdə pyramiding qadağandır (v1.0)
  if (context.hasOpenPosition) {
    failed.push("F3_POSITION_ALREADY_OPEN");
  }

  // F4 — Cooldown: son trade-dən bu yana minimum bar sayı keçməlidir
  if (
    context.barsSinceLastTrade !== null &&
    context.barsSinceLastTrade < config.entry.cooldownBars1h
  ) {
    failed.push("F4_COOLDOWN");
  }

  return { passed: failed.length === 0, failed };
}
