import { describe, it, expect } from "vitest";
import { filterClosed, assertNoGaps, isSaneCandle } from "../src/data/validation.js";
import { DataGapError, TIMEFRAME_MS, type Candle } from "../src/data/types.js";

// Köməkçi: test üçün süni şam düzəldir
function makeCandle(openTime: number, tfMs: number, overrides: Partial<Candle> = {}): Candle {
  return {
    openTime,
    open: 100, high: 110, low: 90, close: 105, volume: 1000,
    closeTime: openTime + tfMs - 1,
    ...overrides,
  };
}

const H1 = TIMEFRAME_MS["1h"];
const T0 = 1720512000000; // sabit başlanğıc vaxtı

describe("filterClosed", () => {
  it("bağlanmamış (hələ formalaşan) şamı atır", () => {
    const closed1 = makeCandle(T0, H1);
    const closed2 = makeCandle(T0 + H1, H1);
    const forming = makeCandle(T0 + 2 * H1, H1); // closeTime hələ gələcəkdədir

    // "İndi" = 3-cü şamın ortası → ilk 2 şam bağlanıb, 3-cü yox
    const now = T0 + 2 * H1 + 30 * 60_000;
    const result = filterClosed([closed1, closed2, forming], now);

    expect(result).toHaveLength(2);
    expect(result.map((c) => c.openTime)).toEqual([T0, T0 + H1]);
  });

  it("bağlanış anının özündə şam hələ bağlanmamış sayılır (closeTime < now, ciddi)", () => {
    const c = makeCandle(T0, H1);
    expect(filterClosed([c], c.closeTime)).toHaveLength(0);
    expect(filterClosed([c], c.closeTime + 1)).toHaveLength(1);
  });
});

describe("assertNoGaps", () => {
  it("fasiləsiz ardıcıllıqda xəta atmır", () => {
    const candles = [0, 1, 2, 3].map((i) => makeCandle(T0 + i * H1, H1));
    expect(() => assertNoGaps(candles, "BTCUSDT", "1h")).not.toThrow();
  });

  it("çatışmayan şam olanda DataGapError atır", () => {
    // 2-ci şam (T0 + 1h) yoxdur — gap!
    const candles = [
      makeCandle(T0, H1),
      makeCandle(T0 + 2 * H1, H1),
    ];
    expect(() => assertNoGaps(candles, "BTCUSDT", "1h")).toThrow(DataGapError);
  });

  it("4h timeframe üçün də düzgün addımla yoxlayır", () => {
    const H4 = TIMEFRAME_MS["4h"];
    const ok = [0, 1, 2].map((i) => makeCandle(T0 + i * H4, H4));
    expect(() => assertNoGaps(ok, "ETHUSDT", "4h")).not.toThrow();

    const bad = [makeCandle(T0, H4), makeCandle(T0 + H4 + H1, H4)];
    expect(() => assertNoGaps(bad, "ETHUSDT", "4h")).toThrow(DataGapError);
  });
});

describe("isSaneCandle", () => {
  it("normal şamı qəbul edir", () => {
    expect(isSaneCandle(makeCandle(T0, H1))).toBe(true);
  });

  it("high < close olan zədəli şamı rədd edir", () => {
    const broken = makeCandle(T0, H1, { high: 104, close: 105 });
    expect(isSaneCandle(broken)).toBe(false);
  });

  it("mənfi/sıfır qiyməti rədd edir", () => {
    const broken = makeCandle(T0, H1, { low: 0 });
    expect(isSaneCandle(broken)).toBe(false);
  });
});
