import type { Candle } from "../data/types.js";

// ===================================================================
// Donchian kanalı (sənəd, giriş E-B1) — breakout girişi üçün.
// upper[i] = son `period` şamın ƏN YÜKSƏK high-ı, CARİ ŞAM XARİC.
// "Cari şam xaric" vacibdir: close(1h) > don_hi müqayisəsində şam öz
// rekordu ilə müqayisə olunmamalıdır — sənəd bunu açıq yazır (E-B1).
// ===================================================================

export function donchianUpper(candles: Candle[], period = 20): number[] {
  const n = candles.length;
  const out: number[] = new Array(n).fill(NaN);
  for (let i = period; i < n; i++) {
    let max = -Infinity;
    for (let j = i - period; j < i; j++) {
      const h = candles[j]!.high;
      if (h > max) max = h;
    }
    out[i] = max;
  }
  return out;
}

export function donchianLower(candles: Candle[], period = 20): number[] {
  const n = candles.length;
  const out: number[] = new Array(n).fill(NaN);
  for (let i = period; i < n; i++) {
    let min = Infinity;
    for (let j = i - period; j < i; j++) {
      const l = candles[j]!.low;
      if (l < min) min = l;
    }
    out[i] = min;
  }
  return out;
}
