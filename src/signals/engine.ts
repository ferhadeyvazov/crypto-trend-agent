import type { Candle } from "../data/types.js";
import { adx } from "../indicators/index.js";
import type { StrategyConfig } from "../config/index.js";
import { computeRegime } from "./regime.js";
import { checkFilters } from "./filters.js";
import { pullbackSignal, breakoutSignal } from "./entrySignals.js";
import type { EntrySignal, FilterContext, Regime } from "./types.js";

export interface EvaluatedSignal extends EntrySignal {
  regime: Regime;
  /** Prioritetləmə üçün (bölmə 8/9: "signals executed in descending order of ADX(4h)") */
  adx4h: number;
}

export interface SignalEvaluation {
  signal: EvaluatedSignal | null;
  regime: Regime;
  /** Rədd səbəbləri — heç nə tapılmayıbsa boşdur */
  rejected: string[];
}

/**
 * Bölmə 9-un "searching for new entries" blokunun təcəssümü:
 * rejim (R4.1–R4.3) → filtrlər (F1–F4) → giriş siqnalları (Pullback / Breakout).
 * F5 (portfel limitləri, bölmə 8) buraya daxil deyil — RiskManager (Mərhələ 4)
 * bunu ayrıca `portfolioLimitsOk()` addımında tətbiq edəcək.
 */
export function evaluateSignal(
  candles4h: Candle[],
  candles1h: Candle[],
  context: FilterContext,
  config: StrategyConfig,
): SignalEvaluation {
  const regimeSeries = computeRegime(candles4h, config);
  const regime = regimeSeries[regimeSeries.length - 1]!;

  if (regime === "NO_TRADE") {
    return { signal: null, regime, rejected: ["REGIME_NO_TRADE"] };
  }

  const filterResult = checkFilters(candles1h, context, config);
  if (!filterResult.passed) {
    return { signal: null, regime, rejected: filterResult.failed };
  }

  const direction = regime === "LONG_ONLY" ? "LONG" : "SHORT";
  const entry = pullbackSignal(candles1h, direction, config) ?? breakoutSignal(candles1h, direction, config);
  if (!entry) {
    return { signal: null, regime, rejected: ["NO_ENTRY_PATTERN"] };
  }

  const adx4hSeries = adx(candles4h, config.indicators.adx_4h.period);
  const adx4h = adx4hSeries[adx4hSeries.length - 1]!;

  return { signal: { ...entry, regime, adx4h }, regime, rejected: [] };
}
