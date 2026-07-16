import type { TradeRecord } from "../execution/types.js";
import type { EquityPoint } from "./types.js";

// ===================================================================
// Equity əyrisi və ondan törənən metrikalar (sənəd, bölmə 11: Max
// Drawdown, Sharpe). Trade jurnalındakı `equityAfter` sahəsi artıq hər
// bağlanışdan sonrakı equity-ni verir — biz sadəcə onu vaxt sırasına düzürük.
// ===================================================================

export function buildEquityCurve(trades: TradeRecord[], initialEquity: number, startTime: number): EquityPoint[] {
  const sorted = [...trades].sort((a, b) => a.exitTime - b.exitTime);
  const curve: EquityPoint[] = [{ time: startTime, equity: initialEquity }];
  for (const t of sorted) curve.push({ time: t.exitTime, equity: t.equityAfter });
  return curve;
}

/**
 * `buildEquityCurve`-dən fərqli olaraq `equityAfter`-ə (bütün portfelin ORTAQ
 * equity-si) yox, YALNIZ verilən trade-lərin öz netPnl-lərinin cəminə əsaslanır.
 * Tier-ə görə FİLTRLƏNMİŞ alt-çoxluqlar üçün lazımdır — `equityAfter` digər
 * tier-in trade-lərinin PnL-ini də ehtiva etdiyi üçün, filtrlənmiş çoxluqda
 * onu birbaşa istifadə etmək digər tier-in nəticəsini bu tier-ə "sızdırar"
 * (bax: src/reporting/report.ts-in `tierBreakdown`-u).
 */
export function buildIsolatedEquityCurve(trades: TradeRecord[], initialEquity: number, startTime: number): EquityPoint[] {
  const sorted = [...trades].sort((a, b) => a.exitTime - b.exitTime);
  const curve: EquityPoint[] = [{ time: startTime, equity: initialEquity }];
  let equity = initialEquity;
  for (const t of sorted) {
    equity += t.netPnl;
    curve.push({ time: t.exitTime, equity });
  }
  return curve;
}

/** Zirvədən-dibə ən böyük düşüş, faizlə (0-100). */
export function computeMaxDrawdownPct(curve: EquityPoint[]): number {
  if (curve.length === 0) return 0;
  let peak = curve[0]!.equity;
  let maxDrawdown = 0;
  for (const point of curve) {
    if (point.equity > peak) peak = point.equity;
    const drawdown = peak > 0 ? (peak - point.equity) / peak : 0;
    if (drawdown > maxDrawdown) maxDrawdown = drawdown;
  }
  return maxDrawdown * 100;
}

/**
 * Gündəlik (UTC) equity seriyası — hər günün SON equity dəyəri, o gün
 * trade olmayıbsa əvvəlki günün dəyəri irəli daşınır (forward-fill).
 */
export function buildDailyEquitySeries(curve: EquityPoint[]): number[] {
  if (curve.length === 0) return [];

  const byDay = new Map<string, number>();
  for (const point of curve) {
    const key = new Date(point.time).toISOString().slice(0, 10);
    byDay.set(key, point.equity); // curve vaxt sırası ilədir → son yazı o günün son dəyəridir
  }

  const firstDay = new Date(curve[0]!.time);
  const lastDay = new Date(curve[curve.length - 1]!.time);
  const series: number[] = [];
  let lastEquity = curve[0]!.equity;

  for (
    let d = Date.UTC(firstDay.getUTCFullYear(), firstDay.getUTCMonth(), firstDay.getUTCDate());
    d <= Date.UTC(lastDay.getUTCFullYear(), lastDay.getUTCMonth(), lastDay.getUTCDate());
    d += 86_400_000
  ) {
    const key = new Date(d).toISOString().slice(0, 10);
    if (byDay.has(key)) lastEquity = byDay.get(key)!;
    series.push(lastEquity);
  }
  return series;
}

export function computeDailyReturns(dailyEquitySeries: number[]): number[] {
  const returns: number[] = [];
  for (let i = 1; i < dailyEquitySeries.length; i++) {
    const prev = dailyEquitySeries[i - 1]!;
    if (prev !== 0) returns.push((dailyEquitySeries[i]! - prev) / prev);
  }
  return returns;
}

/** Sharpe = mean(gündəlik gəlir) / std(gündəlik gəlir) × √365 (illiləşdirmə). */
export function computeSharpe(dailyReturns: number[]): number {
  const n = dailyReturns.length;
  if (n === 0) return 0;
  const mean = dailyReturns.reduce((sum, r) => sum + r, 0) / n;
  const variance = dailyReturns.reduce((sum, r) => sum + (r - mean) ** 2, 0) / n;
  const std = Math.sqrt(variance);
  if (std === 0) return 0;
  return (mean / std) * Math.sqrt(365);
}
