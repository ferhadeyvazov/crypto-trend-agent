import { type Candle, type Timeframe, TIMEFRAME_MS, DataGapError } from "./types.js";

// ===================================================================
// Data bütövlüyü yoxlamaları — "pure" funksiyalar (yan təsirsiz).
// Pure olduqları üçün unit test yazmaq çox asandır: giriş ver, çıxışı yoxla.
// ===================================================================

/**
 * Yalnız bağlanmış şamları saxlayır.
 * Şam o vaxt "bağlanmış" sayılır ki, closeTime < now.
 * Binance son (cari, hələ formalaşan) şamı da qaytarır — onu atırıq,
 * çünki bağlanmamış şamla siqnal hesablamaq repainting deməkdir.
 */
export function filterClosed(candles: Candle[], nowMs: number): Candle[] {
  return candles.filter((c) => c.closeTime < nowMs);
}

/**
 * Ardıcıllıqda gap (çatışmayan şam) axtarır.
 * Qayda: hər növbəti şamın openTime-ı = əvvəlkinin openTime-ı + timeframe.
 * Gap taparsa DataGapError atır — sənədə görə (bölmə 3) belə aktiv
 * 24 saat karantinə düşür, səhv data ilə siqnal hesablamaq qadağandır.
 */
export function assertNoGaps(
  candles: Candle[],
  symbol: string,
  timeframe: Timeframe,
): void {
  const step = TIMEFRAME_MS[timeframe];
  for (let i = 1; i < candles.length; i++) {
    const prev = candles[i - 1]!;
    const curr = candles[i]!;
    const expected = prev.openTime + step;
    if (curr.openTime !== expected) {
      throw new DataGapError(symbol, timeframe, expected, curr.openTime);
    }
  }
}

/**
 * Şamın daxili məntiqinin sağlamlıq yoxlaması:
 * high massivin ən böyüyü, low ən kiçiyi olmalıdır; qiymətlər > 0.
 * API-dən zədəli data gələrsə burada tutulur.
 */
export function isSaneCandle(c: Candle): boolean {
  return (
    c.open > 0 &&
    c.close > 0 &&
    c.high >= Math.max(c.open, c.close) &&
    c.low <= Math.min(c.open, c.close) &&
    c.low > 0 &&
    c.volume >= 0 &&
    c.closeTime > c.openTime
  );
}
