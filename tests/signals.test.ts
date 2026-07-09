import { describe, it, expect } from "vitest";
import type { Candle } from "../src/data/types.js";
import type { StrategyConfig } from "../src/config/index.js";
import { config } from "../src/config/index.js";
import { computeRegime } from "../src/signals/regime.js";
import { pullbackSignal, breakoutSignal } from "../src/signals/entrySignals.js";
import { checkFilters } from "../src/signals/filters.js";
import { evaluateSignal } from "../src/signals/engine.js";

// ===================================================================
// SignalEngine testləri (sənəd, bölmə 4, 5). İndikatorların özü artıq
// tests/indicators.test.ts-də TradingView/pandas ilə doğrulanıb — burada
// composite qaydaların (R4.1-R4.3, E-A1-E-A4, E-B1-E-B3, F1-F4) düzgün
// birləşdirildiyi yoxlanılır: (a) əl ilə qurulmuş dəqiq nümunələr,
// (b) sərhəd şərtlərinin rədd/qəbul davranışı.
// ===================================================================

function mkCandle(i: number, open: number, high: number, low: number, close: number, volume = 1000): Candle {
  return { openTime: i * 3_600_000, open, high, low, close, volume, closeTime: (i + 1) * 3_600_000 - 1 };
}

// ======================= computeRegime (R4.1-R4.3) =======================

function buildTrend(n: number, direction: 1 | -1): Candle[] {
  const out: Candle[] = [];
  let price = direction === 1 ? 100 : 5000;
  for (let i = 0; i < n; i++) {
    const close = price + direction * 2;
    out.push(mkCandle(i, price, Math.max(price, close) + 1, Math.min(price, close) - 1, close));
    price = close;
  }
  return out;
}

function buildChoppy(n: number): Candle[] {
  const out: Candle[] = [];
  for (let i = 0; i < n; i++) {
    const c = 100 + 3 * Math.sin(i / 3);
    out.push(mkCandle(i, c - 0.2, c + 1, c - 1, c));
  }
  return out;
}

describe("computeRegime", () => {
  it("davamlı yüksələn trenddə LONG_ONLY (R4.1)", () => {
    const regime = computeRegime(buildTrend(260, 1), config);
    expect(regime.at(-1)).toBe("LONG_ONLY");
  });

  it("davamlı enən trenddə, allowShort=false olanda NO_TRADE (spot-only qeydi, bölmə 4)", () => {
    const regime = computeRegime(buildTrend(260, -1), config);
    expect(regime.at(-1)).toBe("NO_TRADE");
  });

  it("davamlı enən trenddə, allowShort=true olanda SHORT_ONLY (R4.2)", () => {
    const shortCfg: StrategyConfig = { ...config, system: { ...config.system, allowShort: true } };
    const regime = computeRegime(buildTrend(260, -1), shortCfg);
    expect(regime.at(-1)).toBe("SHORT_ONLY");
  });

  it("yan hərəkətli (choppy) bazarda NO_TRADE — aşağı ADX (R4.3)", () => {
    const regime = computeRegime(buildChoppy(260), config);
    expect(regime.at(-1)).toBe("NO_TRADE");
  });

  it("kifayət qədər tarixçə yoxdursa NO_TRADE (isinmə dövrü, dizayn qaydası 4)", () => {
    const regime = computeRegime(buildTrend(50, 1), config);
    expect(regime[10]).toBe("NO_TRADE");
  });
});

// ======================= pullbackSignal (E-A1-E-A4) =======================

/** 40-bar trend + 30-bar sakit konsolidasiya (EMA21 qiymətə yaxınlaşsın) → baza fixture. */
function buildPullbackBase(): Candle[] {
  const candles: Candle[] = [];
  let price = 100;
  for (let i = 0; i < 40; i++) {
    const open = price;
    const close = price + 1.5;
    candles.push(mkCandle(i, open, close + 0.3, open - 0.3, close));
    price = close;
  }
  for (let i = 40; i < 70; i++) {
    const c = price + 1.5 * Math.sin((i - 40) / 3);
    candles.push(mkCandle(i, c - 0.2, c + 1, c - 1, c));
  }
  return candles;
}

describe("pullbackSignal — LONG", () => {
  it("dəqiq pullback nümunəsində siqnal yaranır (E-A1-E-A4 hamısı ödənir)", () => {
    const candles = buildPullbackBase();
    const base = candles.at(-1)!.close;
    candles.push(mkCandle(70, base, base + 0.1, base - 3, base - 2)); // dip 1: EMA21-ə toxunur
    candles.push(mkCandle(71, base - 2, base - 1.5, base - 3.5, base - 3)); // dip 2
    const pre = candles.at(-1)!;
    candles.push(mkCandle(72, pre.close, pre.close + 3, pre.close - 0.1, pre.close + 2.5)); // bullish bounce

    const sig = pullbackSignal(candles, "LONG", config);
    expect(sig).toEqual({ type: "PULLBACK", direction: "LONG", index: candles.length - 1 });
  });

  it("dip EMA21-ə heç vaxt toxunmursa siqnal yoxdur (E-A1 pozulur)", () => {
    const candles: Candle[] = [];
    let price = 100;
    for (let i = 0; i < 60; i++) {
      const open = price;
      const close = price + 2; // heç dayanmadan yüksəlir — EMA21 həmişə geridə qalır
      candles.push(mkCandle(i, open, close + 0.3, open - 0.3, close));
      price = close;
    }
    expect(pullbackSignal(candles, "LONG", config)).toBeNull();
  });

  it("pullback həddindən dərin olanda siqnal yoxdur (E-A4 pozulur)", () => {
    const candles = buildPullbackBase();
    const base = candles.at(-1)!.close;
    candles.push(mkCandle(70, base, base + 0.1, base - 10, base - 9)); // çox dərin dip
    candles.push(mkCandle(71, base - 9, base - 8.5, base - 11, base - 10));
    const pre = candles.at(-1)!;
    candles.push(mkCandle(72, pre.close, pre.close + 12, pre.close - 0.1, pre.close + 11.5));

    expect(pullbackSignal(candles, "LONG", config)).toBeNull();
  });

  it("cari şam bearish bağlananda siqnal yoxdur (E-A2 pozulur)", () => {
    const candles = buildPullbackBase();
    const base = candles.at(-1)!.close;
    candles.push(mkCandle(70, base, base + 0.1, base - 3, base - 2));
    candles.push(mkCandle(71, base - 2, base - 1.5, base - 3.5, base - 3));
    const pre = candles.at(-1)!;
    // bounce əvəzinə davam edən bearish şam
    candles.push(mkCandle(72, pre.close, pre.close + 0.2, pre.close - 3, pre.close - 2.5));

    expect(pullbackSignal(candles, "LONG", config)).toBeNull();
  });
});

// ======================= breakoutSignal (E-B1-E-B3) =======================

function buildBreakoutBase(): Candle[] {
  const bo: Candle[] = [];
  let bp = 100;
  for (let i = 0; i < 25; i++) bo.push(mkCandle(i, bp, bp + 1, bp - 1, bp, 1000));
  return bo;
}

describe("breakoutSignal — LONG", () => {
  it("Donchian üstündən güclü həcmlə çıxışda siqnal yaranır (E-B1-E-B3)", () => {
    const bo = buildBreakoutBase();
    const last = bo.at(-1)!;
    bo.push(mkCandle(25, last.close, last.close + 5, last.close - 0.1, last.close + 4.5, 2000));

    const sig = breakoutSignal(bo, "LONG", config);
    expect(sig).toEqual({ type: "BREAKOUT", direction: "LONG", index: 25 });
  });

  it("həcm 1.3×SMA-dan azdırsa siqnal yoxdur (E-B2 pozulur)", () => {
    const bo = buildBreakoutBase();
    const last = bo.at(-1)!;
    bo.push(mkCandle(25, last.close, last.close + 5, last.close - 0.1, last.close + 4.5, 1000)); // eyni həcm

    expect(breakoutSignal(bo, "LONG", config)).toBeNull();
  });

  it("şam diapazonu 3×ATR-dən genişdirsə siqnal yoxdur (E-B3 pozulur — manipulyasiya riski)", () => {
    const bo = buildBreakoutBase();
    const last = bo.at(-1)!;
    bo.push(mkCandle(25, last.close, last.close + 20, last.close - 15, last.close + 4.5, 2000));

    expect(breakoutSignal(bo, "LONG", config)).toBeNull();
  });

  it("Donchian üst sərhədini keçməyibsə siqnal yoxdur (E-B1 pozulur)", () => {
    const bo = buildBreakoutBase();
    const last = bo.at(-1)!;
    bo.push(mkCandle(25, last.close, last.close + 0.5, last.close - 0.5, last.close, 2000)); // rekord qırılmayıb

    expect(breakoutSignal(bo, "LONG", config)).toBeNull();
  });
});

// ======================= checkFilters (F1-F4) =======================

function buildNormalCandles(n = 70): Candle[] {
  const out: Candle[] = [];
  for (let i = 0; i < n; i++) out.push(mkCandle(i, 100, 102, 98, 100 + (i % 2 === 0 ? 0.3 : -0.3)));
  return out;
}

describe("checkFilters", () => {
  const normal = buildNormalCandles();

  it("bütün şərtlər ödəndikdə keçir", () => {
    const result = checkFilters(normal, { spreadBps: 5, hasOpenPosition: false, barsSinceLastTrade: 5 }, config);
    expect(result).toEqual({ passed: true, failed: [] });
  });

  it("F1 — bazar 'ölü'dürsə (ATR orta dəyərin 0.7-dən azı) rədd edilir", () => {
    const calm = [...normal];
    for (let i = normal.length; i < normal.length + 20; i++) {
      calm.push(mkCandle(i, 100, 100.3, 99.7, 100 + (i % 2 === 0 ? 0.05 : -0.05)));
    }
    const result = checkFilters(calm, { spreadBps: 5, hasOpenPosition: false, barsSinceLastTrade: 5 }, config);
    expect(result.passed).toBe(false);
    expect(result.failed).toContain("F1_LOW_VOLATILITY");
  });

  it("F2 — spread limitdən genişdirsə rədd edilir", () => {
    const result = checkFilters(normal, { spreadBps: 20, hasOpenPosition: false, barsSinceLastTrade: 5 }, config);
    expect(result).toEqual({ passed: false, failed: ["F2_WIDE_SPREAD"] });
  });

  it("F3 — artıq açıq pozisiya varsa rədd edilir (pyramiding qadağandır)", () => {
    const result = checkFilters(normal, { spreadBps: 5, hasOpenPosition: true, barsSinceLastTrade: 5 }, config);
    expect(result).toEqual({ passed: false, failed: ["F3_POSITION_ALREADY_OPEN"] });
  });

  it("F4 — cooldown bitməyibsə rədd edilir", () => {
    const result = checkFilters(normal, { spreadBps: 5, hasOpenPosition: false, barsSinceLastTrade: 1 }, config);
    expect(result).toEqual({ passed: false, failed: ["F4_COOLDOWN"] });
  });

  it("heç trade olmayıbsa (barsSinceLastTrade=null) F4 avtomatik keçir", () => {
    const result = checkFilters(normal, { spreadBps: 5, hasOpenPosition: false, barsSinceLastTrade: null }, config);
    expect(result.failed).not.toContain("F4_COOLDOWN");
  });
});

// ======================= evaluateSignal (tam inteqrasiya) =======================

describe("evaluateSignal", () => {
  it("rejim NO_TRADE olanda filtrlərə/siqnala baxmadan rədd edir", () => {
    const evaluation = evaluateSignal(buildChoppy(260), buildNormalCandles(), {
      spreadBps: 5,
      hasOpenPosition: false,
      barsSinceLastTrade: 5,
    }, config);
    expect(evaluation.signal).toBeNull();
    expect(evaluation.regime).toBe("NO_TRADE");
    expect(evaluation.rejected).toEqual(["REGIME_NO_TRADE"]);
  });

  it("rejim LONG_ONLY, filtrlər keçir, amma giriş naxışı yoxdursa NO_ENTRY_PATTERN", () => {
    const evaluation = evaluateSignal(buildTrend(260, 1), buildNormalCandles(), {
      spreadBps: 5,
      hasOpenPosition: false,
      barsSinceLastTrade: 5,
    }, config);
    expect(evaluation.signal).toBeNull();
    expect(evaluation.regime).toBe("LONG_ONLY");
    expect(evaluation.rejected).toEqual(["NO_ENTRY_PATTERN"]);
  });

  it("rejim LONG_ONLY, filtrlər rədd edəndə (F3) siqnal axtarılmır", () => {
    const evaluation = evaluateSignal(buildTrend(260, 1), buildNormalCandles(), {
      spreadBps: 5,
      hasOpenPosition: true,
      barsSinceLastTrade: 5,
    }, config);
    expect(evaluation.signal).toBeNull();
    expect(evaluation.rejected).toEqual(["F3_POSITION_ALREADY_OPEN"]);
  });

  it("breakout naxışı LONG_ONLY rejimdə tam siqnala (adx4h daxil) çevrilir", () => {
    // Baza: davamlı trend (F1 üçün sabit ATR, E-A1 üçün EMA21-ə heç vaxt
    // toxunmur — ona görə pullbackSignal yox, breakoutSignal işə düşür).
    const bo = buildTrend(73, 1);
    const last = bo.at(-1)!;
    bo.push(mkCandle(73, last.close, last.close + 2, last.close - 2, last.close + 1.5, 2000));

    const evaluation = evaluateSignal(buildTrend(260, 1), bo, {
      spreadBps: 5,
      hasOpenPosition: false,
      barsSinceLastTrade: 5,
    }, config);
    expect(evaluation.signal).toMatchObject({ type: "BREAKOUT", direction: "LONG", regime: "LONG_ONLY" });
    expect(evaluation.signal!.adx4h).toBeGreaterThanOrEqual(config.indicators.adx_4h.minLong);
    expect(evaluation.rejected).toEqual([]);
  });
});
