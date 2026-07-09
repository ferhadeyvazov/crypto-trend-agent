import { describe, it, expect } from "vitest";
import type { Candle } from "../src/data/types.js";
import {
  sma, ema, rsi, atr, adx, macd, donchianUpper,
} from "../src/indicators/index.js";

// ===================================================================
// İki qat yoxlama:
//  A) Riyazi hallar — cavabı əl ilə bilinən sadə seriyalar.
//  B) Cross-check — 1000 şamlıq deterministik seriya üzərində müstəqil
//     implementasiya (Python/pandas) ilə hesablanmış referans dəyərlər.
//     Tolerans ±0.5% — sənədin öz validasiya meyarı (bölmə 3.1).
// Üçüncü qat — TradingView ilə canlı müqayisə — scripts/validate-tradingview.ts
// ===================================================================

// ---------- Fixture: Python referansı ilə EYNİ düsturlar ----------
function buildFixture(n = 1000): Candle[] {
  const candles: Candle[] = [];
  for (let i = 0; i < n; i++) {
    const close = 100 + 0.1 * i + 5 * Math.sin(i / 5);
    const high = close + 1 + 0.5 * Math.abs(Math.sin(i / 3));
    const low = close - 1 - 0.5 * Math.abs(Math.cos(i / 4));
    const open = i === 0 ? close : candles[i - 1]!.close;
    candles.push({
      openTime: i * 3_600_000,
      open, high, low, close,
      volume: 1000 + 100 * Math.sin(i / 7),
      closeTime: (i + 1) * 3_600_000 - 1,
    });
  }
  return candles;
}

const fixture = buildFixture();
const closes = fixture.map((c) => c.close);

/** Nisbi fərq ±0.5%-dən azdır? (sənədin validasiya meyarı) */
function within05pct(actual: number, expected: number): void {
  const relDiff = Math.abs(actual - expected) / Math.abs(expected);
  expect(relDiff, `actual=${actual}, expected=${expected}`).toBeLessThan(0.005);
}

// =========================== A) Riyazi hallar ===========================

describe("sma — riyazi hallar", () => {
  it("sabit seriyada SMA = həmin sabit", () => {
    const out = sma([5, 5, 5, 5, 5], 3);
    expect(out.slice(2)).toEqual([5, 5, 5]);
  });
  it("əl ilə yoxlanan hal: [1,2,3,4], period 2 → [NaN,1.5,2.5,3.5]", () => {
    const out = sma([1, 2, 3, 4], 2);
    expect(out[0]).toBeNaN();
    expect(out.slice(1)).toEqual([1.5, 2.5, 3.5]);
  });
});

describe("ema — riyazi hallar", () => {
  it("sabit seriyada EMA = həmin sabit", () => {
    const out = ema(new Array(50).fill(7), 10);
    expect(out[49]).toBeCloseTo(7, 10);
  });
  it("isinmə dövrü NaN-dır, period-1 indeksindən başlayır", () => {
    const out = ema([1, 2, 3, 4, 5], 3);
    expect(out[1]).toBeNaN();
    expect(out[2]).toBeCloseTo(2, 10); // seed = SMA(1,2,3)
  });
  it("qiymətlər qalxanda EMA da qalxır (gecikmə ilə)", () => {
    const rising = Array.from({ length: 100 }, (_, i) => 100 + i);
    const out = ema(rising, 20);
    expect(out[99]!).toBeGreaterThan(out[50]!);
    expect(out[99]!).toBeLessThan(199); // EMA həmişə geridə qalır
  });
});

describe("rsi — riyazi hallar", () => {
  it("yalnız yüksələn seriyada RSI = 100", () => {
    const rising = Array.from({ length: 30 }, (_, i) => 100 + i);
    expect(rsi(rising, 14)[29]).toBe(100);
  });
  it("yalnız enən seriyada RSI 0-a yaxındır", () => {
    const falling = Array.from({ length: 30 }, (_, i) => 100 - i);
    expect(rsi(falling, 14)[29]!).toBeLessThan(1);
  });
  it("dəyərlər həmişə 0-100 aralığındadır", () => {
    for (const v of rsi(closes, 14)) {
      if (!Number.isNaN(v)) { expect(v).toBeGreaterThanOrEqual(0); expect(v).toBeLessThanOrEqual(100); }
    }
  });
});

describe("atr — riyazi hallar", () => {
  it("sabit diapazonlu şamlarda ATR = həmin diapazon", () => {
    // Hər şam: high-low = 2, gap yoxdur → TR həmişə 2 → ATR = 2
    const flat: Candle[] = Array.from({ length: 30 }, (_, i) => ({
      openTime: i, open: 100, high: 101, low: 99, close: 100, volume: 1, closeTime: i + 1,
    }));
    expect(atr(flat, 14)[29]).toBeCloseTo(2, 10);
  });
  it("ATR heç vaxt mənfi deyil", () => {
    for (const v of atr(fixture, 14)) {
      if (!Number.isNaN(v)) expect(v).toBeGreaterThanOrEqual(0);
    }
  });
});

describe("adx — riyazi hallar", () => {
  it("dəyərlər 0-100 aralığındadır", () => {
    for (const v of adx(fixture, 14)) {
      if (!Number.isNaN(v)) { expect(v).toBeGreaterThanOrEqual(0); expect(v).toBeLessThanOrEqual(100); }
    }
  });
  it("güclü birtərəfli trenddə ADX yüksəkdir (>40)", () => {
    const trend: Candle[] = Array.from({ length: 100 }, (_, i) => ({
      openTime: i, open: 100 + i * 2, high: 101 + i * 2, low: 99 + i * 2,
      close: 100.5 + i * 2, volume: 1, closeTime: i + 1,
    }));
    expect(adx(trend, 14)[99]!).toBeGreaterThan(40);
  });
});

describe("macd — riyazi hallar", () => {
  it("sabit seriyada macdLine və histogram = 0", () => {
    const { macdLine, histogram } = macd(new Array(100).fill(50));
    expect(macdLine[99]).toBeCloseTo(0, 10);
    expect(histogram[99]).toBeCloseTo(0, 10);
  });
  it("histogram = macdLine - signalLine", () => {
    const { macdLine, signalLine, histogram } = macd(closes);
    const i = 500;
    expect(histogram[i]).toBeCloseTo(macdLine[i]! - signalLine[i]!, 10);
  });
});

describe("donchianUpper — riyazi hallar", () => {
  it("cari şamı HESABA ALMIR (E-B1 qaydası üçün kritik)", () => {
    // Sonuncu şamın high-ı rekorddur — amma upper ondan ƏVVƏLKİ maksimumu göstərməlidir
    const candles: Candle[] = Array.from({ length: 25 }, (_, i) => ({
      openTime: i, open: 100, high: i === 24 ? 999 : 100 + i, low: 90,
      close: 100, volume: 1, closeTime: i + 1,
    }));
    expect(donchianUpper(candles, 20)[24]).toBe(123); // 999 yox!
  });
});

// ================= B) Müstəqil referans ilə cross-check =================
// Referans: pandas (ewm) ilə hesablanmış dəyərlər. Toxum (seed) fərqinə
// görə isinmə dövründə fərq olur, amma 1000 şamda konvergensiya baş verir
// → son dəyərlər ±0.5% çərçivəsində üst-üstə düşməlidir.

describe("cross-check: müstəqil hesablama ilə (indeks 999)", () => {
  it("ema50", () => within05pct(ema(closes, 50)[999]!, 196.89077946081338));
  it("ema200", () => within05pct(ema(closes, 200)[999]!, 189.8397338680983));
  it("ema21", () => within05pct(ema(closes, 21)[999]!, 197.27847840230407));
  it("rsi14", () => within05pct(rsi(closes, 14)[999]!, 33.880656469408976));
  it("atr14", () => within05pct(atr(fixture, 14)[999]!, 2.607541630619846));
  it("adx14", () => within05pct(adx(fixture, 14)[999]!, 35.217744096902955));
  it("macd histogram", () => within05pct(macd(closes).histogram[999]!, -0.7143387256090267));
  it("donchian upper (dəqiq bərabərlik)", () => {
    expect(donchianUpper(fixture, 20)[999]).toBeCloseTo(204.54807640044797, 8);
  });
});

describe("cross-check: ara nöqtə (indeks 500)", () => {
  it("ema50", () => within05pct(ema(closes, 50)[500]!, 146.59447743775974));
  it("rsi14", () => within05pct(rsi(closes, 14)[500]!, 53.32546260269226));
  it("atr14", () => within05pct(atr(fixture, 14)[500]!, 2.5959801519284302));
  it("adx14", () => within05pct(adx(fixture, 14)[500]!, 29.688925835344477));
});
