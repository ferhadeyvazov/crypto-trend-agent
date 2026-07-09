import type { Candle } from "../data/types.js";
import { wilderSmooth } from "./movingAverages.js";

// ===================================================================
// ATR (Average True Range) — Wilder üsulu (sənəd, bölmə 3.1).
// Sadə dildə: bazarın "nəfəs genişliyi" — bir şamda qiymət ortalama
// nə qədər gedib-gəlir. Stop məsafələri bunun üstündə qurulur:
// volatil bazarda stop uzaq, sakit bazarda yaxın olur.
// ===================================================================

/** True Range: şamın öz diapazonu VƏ əvvəlki close-a görə boşluqlar (gap) nəzərə alınmaqla */
export function trueRange(candles: Candle[]): number[] {
  return candles.map((c, i) => {
    if (i === 0) return c.high - c.low;
    const prevClose = candles[i - 1]!.close;
    return Math.max(
      c.high - c.low,
      Math.abs(c.high - prevClose),
      Math.abs(c.low - prevClose),
    );
  });
}

export function atr(candles: Candle[], period = 14): number[] {
  return wilderSmooth(trueRange(candles), period);
}
