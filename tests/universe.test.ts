import { describe, it, expect, vi } from "vitest";
import { CoinGeckoMarketCapSource } from "../src/universe/coinGeckoSource.js";
import { BinanceVolumeSource } from "../src/universe/binanceVolumeSource.js";
import { BinancePairChecker } from "../src/universe/binancePairs.js";
import { UniverseSelector } from "../src/universe/universeSelector.js";
import { isExcludedAsset, isCoreAsset } from "../src/universe/exclusionList.js";
import type { MarketCapSource, RankedAsset } from "../src/universe/types.js";

// ===================================================================
// Universe testləri (sənəd, bölmə 2). Bütün şəbəkə çağırışları fetch
// injection ilə saxtalaşdırılır — real internetə toxunulmur.
// ===================================================================

function fakeFetchOk(data: unknown): typeof fetch {
  return (async () => ({ ok: true, status: 200, json: async () => data })) as unknown as typeof fetch;
}
function fakeFetchError(status: number): typeof fetch {
  return (async () => ({ ok: false, status, json: async () => ({}) })) as unknown as typeof fetch;
}

describe("isExcludedAsset / isCoreAsset", () => {
  it("stablecoin və wrapped token-ləri tanıyır", () => {
    expect(isExcludedAsset("USDT")).toBe(true);
    expect(isExcludedAsset("usdc")).toBe(true);
    expect(isExcludedAsset("WBTC")).toBe(true);
    expect(isExcludedAsset("BTC")).toBe(false);
    expect(isExcludedAsset("SOL")).toBe(false);
  });

  it("BTC/ETH-i əsas aktiv kimi tanıyır", () => {
    expect(isCoreAsset("BTCUSDT")).toBe(true);
    expect(isCoreAsset("ETHUSDT")).toBe(true);
    expect(isCoreAsset("SOLUSDT")).toBe(false);
  });
});

describe("CoinGeckoMarketCapSource", () => {
  it("market cap-a görə sıralanmış aktivləri map edir", async () => {
    const source = new CoinGeckoMarketCapSource({
      fetchFn: fakeFetchOk([
        { symbol: "btc", market_cap: 1_000_000_000, total_volume: 50_000_000 },
        { symbol: "eth", market_cap: 500_000_000, total_volume: 30_000_000 },
      ]),
    });
    const result = await source.fetchTopByMarketCap(2);
    expect(result).toEqual([
      { baseSymbol: "BTC", marketCapUsd: 1_000_000_000, volumeUsd: 50_000_000 },
      { baseSymbol: "ETH", marketCapUsd: 500_000_000, volumeUsd: 30_000_000 },
    ]);
  });

  it("HTTP xətasında atır", async () => {
    const source = new CoinGeckoMarketCapSource({ fetchFn: fakeFetchError(429) });
    await expect(source.fetchTopByMarketCap(10)).rejects.toThrow(/429/);
  });
});

describe("BinanceVolumeSource", () => {
  it("yalnız USDT cütlərini götürüb həcmə görə sıralayır", async () => {
    const source = new BinanceVolumeSource({
      fetchFn: fakeFetchOk([
        { symbol: "BTCUSDT", quoteVolume: "1000000" },
        { symbol: "ETHBTC", quoteVolume: "9999999" }, // USDT cütü deyil — xaric
        { symbol: "SOLUSDT", quoteVolume: "5000000" },
      ]),
    });
    const result = await source.fetchTopByMarketCap(10);
    // SOL (5M) həcmi BTC-dən (1M) çoxdur → azalan sırada əvvəl gəlir
    expect(result.map((r) => r.baseSymbol)).toEqual(["SOL", "BTC"]);
    expect(result[0]!.volumeUsd).toBe(5_000_000);
  });
});

describe("BinancePairChecker", () => {
  it("aktiv USDT cütlərini qaytarır və nəticəni keşləyir (ikinci çağırış fetch etmir)", async () => {
    const fetchFn = vi.fn(fakeFetchOk({
      symbols: [
        { symbol: "BTCUSDT", status: "TRADING", quoteAsset: "USDT" },
        { symbol: "SOLUSDT", status: "BREAK", quoteAsset: "USDT" }, // TRADING deyil — xaric
        { symbol: "BTCETH", status: "TRADING", quoteAsset: "ETH" }, // USDT deyil — xaric
      ],
    }));
    const checker = new BinancePairChecker({ fetchFn });
    const pairs1 = await checker.getActiveUsdtPairs();
    const pairs2 = await checker.getActiveUsdtPairs();
    expect(pairs1).toEqual(new Set(["BTCUSDT"]));
    expect(pairs2).toBe(pairs1); // keşlənmiş eyni obyekt
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });
});

describe("UniverseSelector", () => {
  function mkSource(assets: RankedAsset[]): MarketCapSource {
    return { fetchTopByMarketCap: async () => assets };
  }

  it("stablecoin/wrapped xaric edir, aktiv cütü olmayanları və aşağı həcmliləri filtrləyir", async () => {
    const selector = new UniverseSelector({
      primarySource: mkSource([
        { baseSymbol: "BTC", marketCapUsd: 100, volumeUsd: 100_000_000 },
        { baseSymbol: "USDT", marketCapUsd: 90, volumeUsd: 100_000_000 }, // stablecoin — xaric
        { baseSymbol: "SOL", marketCapUsd: 80, volumeUsd: 100_000_000 },
        { baseSymbol: "NOPAIR", marketCapUsd: 70, volumeUsd: 100_000_000 }, // Binance-də cüt yoxdur — xaric
        { baseSymbol: "LOWVOL", marketCapUsd: 60, volumeUsd: 1_000_000 }, // həcm azdır — xaric
      ]),
      fallbackSource: mkSource([]),
      pairChecker: { getActiveUsdtPairs: async () => new Set(["BTCUSDT", "SOLUSDT", "LOWVOLUSDT"]) },
      minAvgDailyVolumeUsd: 50_000_000,
      maxAssets: 20,
    });
    const universe = await selector.selectUniverse();
    expect(universe).toEqual(["BTCUSDT", "SOLUSDT"]);
  });

  it("ilk N aktivlə məhdudlaşdırır (maxAssets)", async () => {
    const assets: RankedAsset[] = Array.from({ length: 5 }, (_, i) => (
      { baseSymbol: `A${i}`, marketCapUsd: 100 - i, volumeUsd: 100_000_000 }
    ));
    const selector = new UniverseSelector({
      primarySource: mkSource(assets),
      fallbackSource: mkSource([]),
      pairChecker: { getActiveUsdtPairs: async () => new Set(assets.map((a) => `${a.baseSymbol}USDT`)) },
      maxAssets: 2,
    });
    const universe = await selector.selectUniverse();
    expect(universe).toEqual(["A0USDT", "A1USDT"]);
  });

  it("əsas mənbə xəta verəndə fallback-a keçir və xəbərdarlıq edir", async () => {
    const warnings: string[] = [];
    const failingSource: MarketCapSource = {
      fetchTopByMarketCap: async () => { throw new Error("CoinGecko rate limit"); },
    };
    const selector = new UniverseSelector({
      primarySource: failingSource,
      fallbackSource: mkSource([{ baseSymbol: "BTC", marketCapUsd: 0, volumeUsd: 100_000_000 }]),
      pairChecker: { getActiveUsdtPairs: async () => new Set(["BTCUSDT"]) },
      onWarning: (msg) => warnings.push(msg),
      minAvgDailyVolumeUsd: 50_000_000,
    });
    const universe = await selector.selectUniverse();
    expect(universe).toEqual(["BTCUSDT"]);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toMatch(/CoinGecko/);
  });
});
