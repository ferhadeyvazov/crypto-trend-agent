import { wilderSmooth } from "./movingAverages.js";

// ===================================================================
// RSI (Relative Strength Index) — Wilder üsulu (sənəd, bölmə 3.1).
// Sadə dildə: son dövrdə yüksəlişlərin enişlərə nisbətini 0-100
// şkalasına salır. 50+ = alıcılar güclüdür, 50- = satıcılar.
// ===================================================================

export function rsi(closes: number[], period = 14): number[] {
  const n = closes.length;
  const out: number[] = new Array(n).fill(NaN);
  if (n < period + 1) return out;

  const gains: number[] = new Array(n - 1);
  const losses: number[] = new Array(n - 1);
  for (let i = 1; i < n; i++) {
    const diff = closes[i]! - closes[i - 1]!;
    gains[i - 1] = diff > 0 ? diff : 0;
    losses[i - 1] = diff < 0 ? -diff : 0;
  }

  const avgGain = wilderSmooth(gains, period);
  const avgLoss = wilderSmooth(losses, period);

  // gains[j] (j+1)-ci şama aiddir → nəticə 1 indeks irəli sürüşür
  for (let j = period - 1; j < n - 1; j++) {
    const g = avgGain[j]!;
    const l = avgLoss[j]!;
    out[j + 1] = l === 0 ? 100 : 100 - 100 / (1 + g / l); // 0-a bölmə qoruması
  }
  return out;
}
