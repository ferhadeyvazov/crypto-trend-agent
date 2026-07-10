import type { TradeRecord } from "../execution/types.js";
import { buildEquityCurve, buildDailyEquitySeries, computeDailyReturns, computeMaxDrawdownPct, computeSharpe } from "./equityCurve.js";
import type { PerformanceMetrics } from "./types.js";

// ===================================================================
// Performans metrikaları (sənəd, bölmə 11). Hamısı trade jurnalından
// (TradeRecord[]) törənir — xalis funksiyalar.
// ===================================================================

export function computeNetPnl(trades: TradeRecord[]): number {
  return trades.reduce((sum, t) => sum + t.netPnl, 0);
}

export function computeProfitFactor(trades: TradeRecord[]): number {
  const wins = trades.filter((t) => t.netPnl > 0).reduce((sum, t) => sum + t.netPnl, 0);
  const losses = Math.abs(trades.filter((t) => t.netPnl < 0).reduce((sum, t) => sum + t.netPnl, 0));
  if (losses === 0) return wins > 0 ? Infinity : 0;
  return wins / losses;
}

export function computeWinRate(trades: TradeRecord[]): number {
  if (trades.length === 0) return 0;
  return trades.filter((t) => t.netPnl > 0).length / trades.length;
}

export function computeAvgRMultiple(trades: TradeRecord[]): number {
  if (trades.length === 0) return 0;
  return trades.reduce((sum, t) => sum + t.rMultiple, 0) / trades.length;
}

/** Təqvim günü ilə davametmə: ilk giriş → son çıxış. */
export function computeDurationDays(trades: TradeRecord[]): number {
  if (trades.length === 0) return 0;
  const minEntry = Math.min(...trades.map((t) => t.entryTime));
  const maxExit = Math.max(...trades.map((t) => t.exitTime));
  return (maxExit - minEntry) / 86_400_000;
}

export function computePerformanceMetrics(
  trades: TradeRecord[],
  initialEquity: number,
  startTime: number,
  criticalErrorCount30d: number,
): PerformanceMetrics {
  const curve = buildEquityCurve(trades, initialEquity, startTime);
  const dailyReturns = computeDailyReturns(buildDailyEquitySeries(curve));

  return {
    netPnl: computeNetPnl(trades),
    profitFactor: computeProfitFactor(trades),
    maxDrawdownPct: computeMaxDrawdownPct(curve),
    winRate: computeWinRate(trades),
    avgRMultiple: computeAvgRMultiple(trades),
    tradeCount: trades.length,
    durationDays: computeDurationDays(trades),
    sharpe: computeSharpe(dailyReturns),
    criticalErrorCount30d,
  };
}
