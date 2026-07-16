export type { EquityPoint, PerformanceMetrics, GoLiveEvaluation } from "./types.js";
export {
  buildEquityCurve,
  buildIsolatedEquityCurve,
  computeMaxDrawdownPct,
  buildDailyEquitySeries,
  computeDailyReturns,
  computeSharpe,
} from "./equityCurve.js";
export {
  computeNetPnl,
  computeProfitFactor,
  computeWinRate,
  computeAvgRMultiple,
  computeDurationDays,
  computePerformanceMetrics,
} from "./metrics.js";
export { evaluateGoLiveCriteria } from "./goLive.js";
export { buildPerformanceReport, topTrades, type PerformanceReport } from "./report.js";
