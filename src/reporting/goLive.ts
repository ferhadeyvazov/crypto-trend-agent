import type { StrategyConfig } from "../config/index.js";
import type { GoLiveEvaluation, PerformanceMetrics } from "./types.js";

// ===================================================================
// Go-live keçid qaydası (sənəd, bölmə 11): "ALL thresholds must be met
// simultaneously" — bir dənəsi ödənməsə belə keçid mümkün deyil.
// Parametrləri "qazandırana kimi" dəyişmək QADAĞANDIR (dizayn qaydası 2) —
// bu funksiya yalnız YOXLAYIR, heç nəyi düzəltmir və ya "optimallaşdırmır".
// ===================================================================

export function evaluateGoLiveCriteria(metrics: PerformanceMetrics, config: StrategyConfig): GoLiveEvaluation {
  const failed: string[] = [];

  if (!(metrics.netPnl > 0)) failed.push("NET_PNL");
  if (!(metrics.profitFactor >= config.goLiveCriteria.profitFactorMin)) failed.push("PROFIT_FACTOR");
  if (!(metrics.maxDrawdownPct <= config.goLiveCriteria.maxDrawdownPct)) failed.push("MAX_DRAWDOWN");
  if (!(metrics.winRate >= config.goLiveCriteria.winRateMin)) failed.push("WIN_RATE");
  if (!(metrics.avgRMultiple >= config.goLiveCriteria.avgRMultipleMin)) failed.push("AVG_R_MULTIPLE");
  if (!(metrics.tradeCount >= config.paperTrading.minClosedTrades)) failed.push("TRADE_COUNT");
  if (!(metrics.durationDays >= config.paperTrading.minDays)) failed.push("DURATION");
  if (!(metrics.sharpe >= config.goLiveCriteria.sharpeMin)) failed.push("SHARPE");
  if (metrics.criticalErrorCount30d > 0) failed.push("TECHNICAL_STABILITY");

  return {
    eligible: failed.length === 0,
    failed,
    requiresExplicitUserApproval: config.goLiveCriteria.requiresExplicitUserApproval,
  };
}
