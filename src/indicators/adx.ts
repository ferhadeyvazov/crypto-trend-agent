import type { Candle } from "../data/types.js";
import { wilderSmooth } from "./movingAverages.js";
import { trueRange } from "./atr.js";

// ===================================================================
// ADX (Average Directional Index) — Wilder üsulu (sənəd, bölmə 3.1).
// Sadə dildə: trendin GÜCÜNÜ ölçür (istiqamətini yox!). ADX 23+ =
// bazarda həqiqi trend var; aşağı ADX = yan hərəkət (chop).
// Sistem üçün kritik filtrdir — trendsiz bazarda girişi bağlayır.
// ===================================================================

export function adx(candles: Candle[], period = 14): number[] {
  const n = candles.length;
  const out: number[] = new Array(n).fill(NaN);
  if (n < 2 * period) return out;

  // İstiqamətli hərəkətlər: bu şam əvvəlkinə görə yuxarı, yoxsa aşağı "itələyib"?
  const plusDM: number[] = new Array(n - 1);
  const minusDM: number[] = new Array(n - 1);
  for (let i = 1; i < n; i++) {
    const upMove = candles[i]!.high - candles[i - 1]!.high;
    const downMove = candles[i - 1]!.low - candles[i]!.low;
    plusDM[i - 1] = upMove > downMove && upMove > 0 ? upMove : 0;
    minusDM[i - 1] = downMove > upMove && downMove > 0 ? downMove : 0;
  }

  const tr = trueRange(candles).slice(1); // DM ilə eyni uzunluq (n-1)
  const smTR = wilderSmooth(tr, period);
  const smPlus = wilderSmooth(plusDM, period);
  const smMinus = wilderSmooth(minusDM, period);

  // DX: +DI və -DI arasındakı fərqin nisbəti (0-100)
  const dx: number[] = new Array(n - 1).fill(NaN);
  for (let j = period - 1; j < n - 1; j++) {
    const trv = smTR[j]!;
    if (trv === 0) { dx[j] = 0; continue; }
    const pdi = (100 * smPlus[j]!) / trv;
    const mdi = (100 * smMinus[j]!) / trv;
    const sum = pdi + mdi;
    dx[j] = sum === 0 ? 0 : (100 * Math.abs(pdi - mdi)) / sum;
  }

  // ADX = DX-in Wilder hamarlaması (yalnız etibarlı DX dəyərləri üzərində)
  const validDx = dx.slice(period - 1);
  const smoothed = wilderSmooth(validDx, period);
  for (let k = 0; k < smoothed.length; k++) {
    if (!Number.isNaN(smoothed[k]!)) {
      // validDx[k] → dx[(period-1)+k] → şam indeksi (period-1)+k+1
      out[period + k] = smoothed[k]!;
    }
  }
  return out;
}
