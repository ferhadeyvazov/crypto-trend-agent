import { ema } from "./movingAverages.js";

// ===================================================================
// MACD (12/26/9) — momentum təsdiqi üçün (sənəd, giriş E-A3).
// Sadə dildə: sürətli və yavaş EMA arasındakı məsafəni izləyir.
// Histoqramın mənfidən müsbətə keçməsi = momentum yuxarı dönür.
// ===================================================================

export interface MacdResult {
  macdLine: number[];
  signalLine: number[];
  histogram: number[];
}

export function macd(closes: number[], fast = 12, slow = 26, signal = 9): MacdResult {
  const n = closes.length;
  const fastEma = ema(closes, fast);
  const slowEma = ema(closes, slow);

  const macdLine: number[] = new Array(n).fill(NaN);
  for (let i = 0; i < n; i++) {
    const f = fastEma[i]!;
    const s = slowEma[i]!;
    if (!Number.isNaN(f) && !Number.isNaN(s)) macdLine[i] = f - s;
  }

  // Signal xətti macdLine-ın etibarlı (NaN olmayan) hissəsi üzərində hesablanır
  const firstValid = macdLine.findIndex((v) => !Number.isNaN(v));
  const signalLine: number[] = new Array(n).fill(NaN);
  const histogram: number[] = new Array(n).fill(NaN);
  if (firstValid >= 0) {
    const sig = ema(macdLine.slice(firstValid), signal);
    for (let i = 0; i < sig.length; i++) {
      if (!Number.isNaN(sig[i]!)) {
        signalLine[firstValid + i] = sig[i]!;
        histogram[firstValid + i] = macdLine[firstValid + i]! - sig[i]!;
      }
    }
  }
  return { macdLine, signalLine, histogram };
}
