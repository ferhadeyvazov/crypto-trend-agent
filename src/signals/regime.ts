import type { Candle } from "../data/types.js";
import { ema, adx } from "../indicators/index.js";
import type { StrategyConfig } from "../config/index.js";
import type { Regime } from "./types.js";

// ===================================================================
// 4h rejim filtri (sənəd, bölmə 4: R4.1–R4.3).
// Sadə dildə: bazar həqiqətən trenddədirmi (və hansı istiqamətdə)?
// Yoxsa yan hərəkətdədir (NO_TRADE)? 1h girişlər YALNIZ bu rejimin
// icazə verdiyi istiqamətdə axtarılır.
//
// Çıxış konvensiyası indikatorlarla eynidir (giriş ilə eyni uzunluq,
// indekslər üst-üstə düşür) — amma isinmə dövründə NaN yerinə "NO_TRADE"
// defolt dəyəri qaytarılır: kifayət qədər tarixçə yoxdursa, sistem
// mühafizəkar davranır və trade açmır (dizayn qaydası 4: "şübhə → dayan").
// ===================================================================

export function computeRegime(candles4h: Candle[], config: StrategyConfig): Regime[] {
  const n = candles4h.length;
  const out: Regime[] = new Array(n).fill("NO_TRADE");

  const closes = candles4h.map((c) => c.close);
  const ema50 = ema(closes, config.indicators.ema_fast_4h);
  const ema200 = ema(closes, config.indicators.ema_slow_4h);
  const adx14 = adx(candles4h, config.indicators.adx_4h.period);
  const lookback = config.indicators.emaSlopeLookback;
  const minAdx = config.indicators.adx_4h.minLong;

  for (let i = lookback; i < n; i++) {
    const e50 = ema50[i]!;
    const e200 = ema200[i]!;
    const adxVal = adx14[i]!;
    const e50Prev = ema50[i - lookback]!;
    if (Number.isNaN(e50) || Number.isNaN(e200) || Number.isNaN(adxVal) || Number.isNaN(e50Prev)) {
      continue; // isinmə bitməyib → NO_TRADE defolt qalır
    }

    const c = closes[i]!;
    const slope = e50 - e50Prev; // R4.1.4 / R4.2.4: EMA50 slope

    if (c > e50 && e50 > e200 && adxVal >= minAdx && slope > 0) {
      out[i] = "LONG_ONLY"; // R4.1
    } else if (
      config.system.allowShort &&
      c < e50 && e50 < e200 && adxVal >= minAdx && slope < 0
    ) {
      out[i] = "SHORT_ONLY"; // R4.2
    }
    // Əks halda R4.3: NO_TRADE. allowShort=false olan (spot-only) mühitdə
    // SHORT şərtləri ödənsə belə NO_TRADE qalır (sənəd, bölmə 4 qeydi).
  }

  return out;
}
