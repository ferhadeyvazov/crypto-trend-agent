import type { StrategyConfig } from "../config/index.js";
import type { TradeRecord } from "../execution/types.js";
import { buildEquityCurve } from "./equityCurve.js";
import { computePerformanceMetrics } from "./metrics.js";
import { evaluateGoLiveCriteria } from "./goLive.js";
import type { EquityPoint, GoLiveEvaluation, PerformanceMetrics } from "./types.js";

export interface PerformanceReport {
  metrics: PerformanceMetrics;
  goLive: GoLiveEvaluation;
  /** netPnl-ə görə azalan sırada, ən çox 5 */
  bestTrades: TradeRecord[];
  /** netPnl-ə görə artan sırada, ən çox 5 */
  worstTrades: TradeRecord[];
  equityCurve: EquityPoint[];
}

export function topTrades(trades: TradeRecord[], count: number, best: boolean): TradeRecord[] {
  const sorted = [...trades].sort((a, b) => (best ? b.netPnl - a.netPnl : a.netPnl - b.netPnl));
  return sorted.slice(0, count);
}

/**
 * Bölmə 11/13-ün "hesabat" tələbinin hesablana bilən hissəsi: metrikalar,
 * go-live yoxlaması, equity əyrisi, ən yaxşı/pis 5 trade. Rədd-siqnal
 * statistikası və universe-dəyişiklikləri XARİC — bunlar üçün data mənbəyi
 * (SignalEngine/RiskManager rədd loglaması, Universe modulu) hələ tikilməyib.
 */
export function buildPerformanceReport(
  trades: TradeRecord[],
  config: StrategyConfig,
  context: { startTime: number; criticalErrorCount30d: number },
): PerformanceReport {
  const metrics = computePerformanceMetrics(
    trades,
    config.paperTrading.initialEquityUsd,
    context.startTime,
    context.criticalErrorCount30d,
  );
  const goLive = evaluateGoLiveCriteria(metrics, config);
  const equityCurve = buildEquityCurve(trades, config.paperTrading.initialEquityUsd, context.startTime);

  return {
    metrics,
    goLive,
    bestTrades: topTrades(trades, 5, true),
    worstTrades: topTrades(trades, 5, false),
    equityCurve,
  };
}
