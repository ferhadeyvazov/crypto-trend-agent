import type { Candle } from "../data/types.js";
import { ema, rsi, atr, macd, donchianUpper, donchianLower, sma } from "../indicators/index.js";
import type { StrategyConfig } from "../config/index.js";
import type { EntrySignal, SignalDirection } from "./types.js";

// ===================================================================
// 1h giriş siqnalları (sənəd, bölmə 5.1 Pullback, 5.2 Breakout).
// Hər funksiya YALNIZ son (indeks = candles.length-1) bağlanmış şamı
// qiymətləndirir — icra dövrü (bölmə 9) hər 1h şam bağlananda bir dəfə
// işləyir, keçmiş şamlara "geri baxıb" siqnal axtarmır.
// SHORT üçün bütün müqayisələr "güzgülənir" (sənəd, bölmə 5: "for SHORT
// all comparisons are mirrored").
// ===================================================================

/** RSI 40-65 (LONG) → güzgülənmiş 35-60 (SHORT), 50 ətrafında simmetrik. */
function mirroredRsiRange(config: StrategyConfig): { min: number; max: number } {
  const { min, max } = config.indicators.rsi_1h;
  return { min: 100 - max, max: 100 - min };
}

/**
 * Pullback girişi (E-A1–E-A4).
 * Qeyd (spesifikasiya interpretasiyası): E-A4-də "no bar closed below…"
 * ifadəsi hansı pəncərəyə aiddir dəqiq deyilməyib — E-A1 ilə eyni
 * "son 3 şam" pəncərəsi istifadə olunur, çünki bu, pullback hadisəsinin
 * baş verdiyi dövrdür.
 */
export function pullbackSignal(
  candles: Candle[],
  direction: SignalDirection,
  config: StrategyConfig,
): EntrySignal | null {
  const n = candles.length;
  const i = n - 1;
  const emaPeriod = config.indicators.ema_pullback_1h;
  if (i < emaPeriod + 2) return null; // isinmə + "son 3 şam" pəncərəsi üçün kifayət deyil

  const isLong = direction === "LONG";
  const closes = candles.map((c) => c.close);
  const ema21 = ema(closes, emaPeriod);
  const rsi14 = rsi(closes, config.indicators.rsi_1h.period);
  const [fast, slow, signal] = config.indicators.macd_1h;
  const { histogram } = macd(closes, fast, slow, signal);
  const atr14 = atr(candles, config.indicators.atr_1h.period);

  const e21 = ema21[i]!;
  const a14 = atr14[i]!;
  const r0 = rsi14[i]!;
  const r1 = rsi14[i - 1]!;
  const h0 = histogram[i]!;
  const h1 = histogram[i - 1]!;
  if ([e21, a14, r0, r1, h0, h1].some(Number.isNaN)) return null;

  // E-A1: son 3 şamdan birində qiymət EMA21-ə toxunub/keçib
  let touched = false;
  for (let j = i - 2; j <= i; j++) {
    const e = ema21[j]!;
    if (Number.isNaN(e)) continue;
    const cnd = candles[j]!;
    if (isLong ? cnd.low <= e : cnd.high >= e) { touched = true; break; }
  }
  if (!touched) return null;

  // E-A2: cari şam trend istiqamətində bağlanıb və EMA21-i geri keçib
  const last = candles[i]!;
  const closedWithTrend = isLong ? last.close > last.open : last.close < last.open;
  const backAcrossEma = isLong ? last.close > e21 : last.close < e21;
  if (!closedWithTrend || !backAcrossEma) return null;

  // E-A3: momentum təsdiqi — RSI dönüşü VƏ YA MACD histoqram işarə dəyişməsi
  const rsiRange = isLong ? config.indicators.rsi_1h : mirroredRsiRange(config);
  const rsiTurn = r0 >= rsiRange.min && r0 <= rsiRange.max && (isLong ? r0 > r1 : r0 < r1);
  const macdCross = isLong ? h1 < 0 && h0 > 0 : h1 > 0 && h0 < 0;
  if (!rsiTurn && !macdCross) return null;

  // E-A4: pullback dərinliyi həddindən artıq deyil (E-A1 ilə eyni pəncərə)
  const depthMult = config.indicators.pullbackMaxDepthAtrMult;
  for (let j = i - 2; j <= i; j++) {
    const threshold = isLong ? e21 - depthMult * a14 : e21 + depthMult * a14;
    const cnd = candles[j]!;
    if (isLong ? cnd.close < threshold : cnd.close > threshold) return null;
  }

  return { type: "PULLBACK", direction, index: i };
}

/** Donchian breakout girişi (E-B1–E-B3). */
export function breakoutSignal(
  candles: Candle[],
  direction: SignalDirection,
  config: StrategyConfig,
): EntrySignal | null {
  const n = candles.length;
  const i = n - 1;
  const donchianPeriod = config.indicators.donchian_1h;
  if (i < donchianPeriod) return null;

  const isLong = direction === "LONG";
  const volumes = candles.map((c) => c.volume);
  const volSma = sma(volumes, config.indicators.volumeSma_1h);
  const atr14 = atr(candles, config.indicators.atr_1h.period);
  const donchian = isLong
    ? donchianUpper(candles, donchianPeriod)
    : donchianLower(candles, donchianPeriod);

  const last = candles[i]!;
  const donVal = donchian[i]!;
  const vSma = volSma[i]!;
  const a14 = atr14[i]!;
  if ([donVal, vSma, a14].some(Number.isNaN)) return null;

  // E-B1: cari şamın bağlanışı öncəki 20 şamın Donchian sərhədini keçib (cari şam xaric)
  const brokeOut = isLong ? last.close > donVal : last.close < donVal;
  if (!brokeOut) return null;

  // E-B2: həcm təsdiqi
  if (last.volume <= config.indicators.breakoutVolumeMult * vSma) return null;

  // E-B3: breakout şamı anormal genişlikdə deyil (manipulyasiya riski)
  if (last.high - last.low > config.indicators.maxBarRangeAtrMult * a14) return null;

  return { type: "BREAKOUT", direction, index: i };
}
