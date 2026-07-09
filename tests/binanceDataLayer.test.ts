import { describe, it, expect, vi } from "vitest";
import { BinanceDataLayer } from "../src/data/binance/BinanceDataLayer.js";
import { TIMEFRAME_MS } from "../src/data/types.js";
import type { RawKline } from "../src/data/binance/parseKline.js";

// ===================================================================
// Bu testlərdə real internetə çıxmırıq: fetch və saat "saxtadır".
// Məqsəd: DataLayer-in ZƏMANƏTLƏRİNİ yoxlamaq —
//   1) bağlanmamış şam heç vaxt qayıtmır
//   2) gap → xəta + karantin
//   3) karantindəki aktivə sorğu → xəta
//   4) rate limit → retry işləyir
// ===================================================================

const H1 = TIMEFRAME_MS["1h"];
const T0 = 1720512000000;

function makeRawKlines(count: number, startTime = T0, skipIndex = -1): RawKline[] {
  const out: RawKline[] = [];
  for (let i = 0; i < count; i++) {
    if (i === skipIndex) continue; // gap yaratmaq üçün
    const open = startTime + i * H1;
    out.push([open, "100", "110", "90", "105", "1000", open + H1 - 1]);
  }
  return out;
}

function fakeFetchReturning(klines: RawKline[]): typeof fetch {
  return vi.fn(async () =>
    new Response(JSON.stringify(klines), { status: 200 }),
  ) as unknown as typeof fetch;
}

describe("BinanceDataLayer.getClosedCandles", () => {
  it("bağlanmamış şamı HEÇ VAXT qaytarmır", async () => {
    const klines = makeRawKlines(10);
    // "İndi" = 10-cu şamın ortası → sonuncu şam hələ formalaşır
    const now = T0 + 9 * H1 + 30 * 60_000;
    const dl = new BinanceDataLayer({
      fetchFn: fakeFetchReturning(klines),
      now: () => now,
    });

    const result = await dl.getClosedCandles("BTCUSDT", "1h", 5);

    expect(result).toHaveLength(5);
    for (const c of result) {
      expect(c.closeTime).toBeLessThan(now); // hamısı bağlanıb
    }
    // Ən son qaytarılan şam 9-cu yox, 8-cidir (9-cu hələ açıqdır)
    expect(result[result.length - 1]!.openTime).toBe(T0 + 8 * H1);
  });

  it("gap aşkarlananda xəta atır VƏ aktivi karantinə salır", async () => {
    const klinesWithGap = makeRawKlines(10, T0, 5); // 5-ci şam yoxdur
    const now = T0 + 20 * H1;
    const dl = new BinanceDataLayer({
      fetchFn: fakeFetchReturning(klinesWithGap),
      now: () => now,
    });

    await expect(dl.getClosedCandles("BTCUSDT", "1h", 8)).rejects.toThrow(/gap/i);
    expect(dl.isQuarantined("BTCUSDT")).toBe(true);

    // Karantindəki aktivə təkrar sorğu → API-yə getmədən xəta
    await expect(dl.getClosedCandles("BTCUSDT", "1h", 8)).rejects.toThrow(/karantin/i);
  });

  it("karantin müddəti bitəndə aktiv azad olur", async () => {
    let now = T0 + 20 * H1;
    const dl = new BinanceDataLayer({
      fetchFn: fakeFetchReturning(makeRawKlines(10, T0, 5)),
      now: () => now,
      quarantineHours: 24,
    });

    await expect(dl.getClosedCandles("BTCUSDT", "1h", 8)).rejects.toThrow();
    expect(dl.isQuarantined("BTCUSDT")).toBe(true);

    now += 24 * 3_600_000 + 1; // 24 saat keçdi
    expect(dl.isQuarantined("BTCUSDT")).toBe(false);
  });

  it("rate limit (429) alanda retry edir və sonda uğur qazanır", async () => {
    const klines = makeRawKlines(10);
    let calls = 0;
    const flakyFetch = vi.fn(async () => {
      calls++;
      if (calls <= 2) return new Response("rate limited", { status: 429 });
      return new Response(JSON.stringify(klines), { status: 200 });
    }) as unknown as typeof fetch;

    const dl = new BinanceDataLayer({
      fetchFn: flakyFetch,
      now: () => T0 + 20 * H1,
      baseBackoffMs: 1, // testdə gözləməmək üçün
    });

    const result = await dl.getClosedCandles("BTCUSDT", "1h", 5);
    expect(result).toHaveLength(5);
    expect(calls).toBe(3); // 2 uğursuz + 1 uğurlu
  });

  it("keş işləyir: TTL ərzində ikinci sorğu API-yə getmir", async () => {
    const fetchFn = fakeFetchReturning(makeRawKlines(10));
    const dl = new BinanceDataLayer({
      fetchFn,
      now: () => T0 + 20 * H1,
      cacheTtlMs: 60_000,
    });

    await dl.getClosedCandles("BTCUSDT", "1h", 5);
    await dl.getClosedCandles("BTCUSDT", "1h", 5);

    expect((fetchFn as unknown as { mock: { calls: unknown[] } }).mock.calls).toHaveLength(1);
  });
});
