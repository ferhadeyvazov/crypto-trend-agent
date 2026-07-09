// ===================================================================
// Hərəkətli ortalamalar — bütün indikatorların təməli.
//
// Ümumi konvensiya (bütün indikator faylları üçün):
//   - Giriş: number[] (və ya Candle[])
//   - Çıxış: girişlə EYNİ uzunluqda number[]
//   - Hələ hesablana bilməyən "isinmə" (warm-up) dövrü = NaN
// Bu konvensiya sayəsində istənilən indikatorun i-ci dəyəri həmişə
// i-ci şama uyğun gəlir — indeks sürüşməsi səhvi mümkün deyil.
// ===================================================================

/** Sadə hərəkətli ortalama. İlk (period-1) dəyər NaN-dır. */
export function sma(values: number[], period: number): number[] {
  const out: number[] = new Array(values.length).fill(NaN);
  if (period <= 0 || values.length < period) return out;

  let sum = 0;
  for (let i = 0; i < values.length; i++) {
    sum += values[i]!;
    if (i >= period) sum -= values[i - period]!;
    if (i >= period - 1) out[i] = sum / period;
  }
  return out;
}

/**
 * Eksponensial hərəkətli ortalama.
 * Toxum (seed): ilk `period` dəyərin SMA-sı — TradingView və klassik
 * ədəbiyyatla uyğun yanaşma. Sonra: EMA = qiymət*k + əvvəlkiEMA*(1-k),
 * k = 2/(period+1).
 *
 * VACİB: EMA "yaddaşlı" indikatordur — dəqiq dəyər üçün kifayət qədər
 * tarixçə lazımdır. Qayda: minimum 4-5 × period qədər şam ver
 * (EMA200 üçün ~1000 şam). Sənədin ±0.5% validasiya tələbi də
 * məhz buna görədir.
 */
export function ema(values: number[], period: number): number[] {
  const out: number[] = new Array(values.length).fill(NaN);
  if (period <= 0 || values.length < period) return out;

  let seed = 0;
  for (let i = 0; i < period; i++) seed += values[i]!;
  let prev = seed / period;
  out[period - 1] = prev;

  const k = 2 / (period + 1);
  for (let i = period; i < values.length; i++) {
    prev = values[i]! * k + prev * (1 - k);
    out[i] = prev;
  }
  return out;
}

/**
 * Wilder hamarlaması (RMA) — RSI, ATR, ADX bunun üstündə qurulub.
 * EMA kimidir, amma k = 1/period. Toxum: ilk `period` dəyərin SMA-sı.
 */
export function wilderSmooth(values: number[], period: number): number[] {
  const out: number[] = new Array(values.length).fill(NaN);
  if (period <= 0 || values.length < period) return out;

  let seed = 0;
  for (let i = 0; i < period; i++) seed += values[i]!;
  let prev = seed / period;
  out[period - 1] = prev;

  const k = 1 / period;
  for (let i = period; i < values.length; i++) {
    prev = values[i]! * k + prev * (1 - k);
    out[i] = prev;
  }
  return out;
}
