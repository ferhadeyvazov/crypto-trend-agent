import { isExcludedAsset } from "./exclusionList.js";
import type { MarketCapSource, Tier } from "./types.js";
import type { BinancePairChecker } from "./binancePairs.js";

// ===================================================================
// Universe seçimi (sənəd, bölmə 2): top 30 market cap → stablecoin/wrapped
// xaric → Binance USDT cütü mövcud olmalı → həcm ≥ minAvgDailyVolumeUsd
// → ilk 20. Hər həftə bazar ertəsi 00:00 UTC-də yenidən qurulur (bunu
// çağıran — main.ts-in scheduler-i — idarə edir, bu sinif təkcə BİR dəfəlik
// seçimi edir).
//
// Tier2 (əlavə, opsional): rank 21-100 mid-cap/alt seqmenti, öz
// minAvgDailyVolumeUsd/maxAssets limitləri ilə. Tier1 məntiqi bundan
// tamamilə asılı deyil və dəyişməyib — Tier2 sadəcə üstünə əlavə olunur.
// ===================================================================

export interface UniverseSelectorTier2Options {
  maxRank: number;
  maxAssets: number;
  minAvgDailyVolumeUsd: number;
}

export interface UniverseSelectorOptions {
  primarySource: MarketCapSource;
  fallbackSource: MarketCapSource;
  pairChecker: BinancePairChecker;
  /** CoinGecko əlçatmaz olub fallback-a keçiləndə çağırılır (WARN logu üçün) */
  onWarning?: (message: string) => void;
  topN?: number;
  maxAssets?: number;
  minAvgDailyVolumeUsd?: number;
  /** Verilməsə, Tier2 seçilmir (yalnız Tier1 universe qaytarılır). */
  tier2?: UniverseSelectorTier2Options;
}

export interface UniverseSelectionResult {
  universe: string[];
  tierMap: Record<string, Tier>;
}

export class UniverseSelector {
  constructor(private opts: UniverseSelectorOptions) {}

  async selectUniverse(): Promise<UniverseSelectionResult> {
    const tier1 = await this.selectTier1();
    const tier2 = await this.selectTier2(tier1);

    const tierMap: Record<string, Tier> = {};
    for (const pair of tier1) tierMap[pair] = "TIER1";
    for (const pair of tier2) tierMap[pair] = "TIER2";

    return { universe: [...tier1, ...tier2], tierMap };
  }

  private async selectTier1(): Promise<string[]> {
    const topN = this.opts.topN ?? 30;
    const maxAssets = this.opts.maxAssets ?? 20;
    const minVolume = this.opts.minAvgDailyVolumeUsd ?? 50_000_000;

    let ranked;
    try {
      ranked = await this.opts.primarySource.fetchTopByMarketCap(topN);
    } catch (err) {
      this.opts.onWarning?.(
        `CoinGecko əlçatan deyil, Binance həcm sıralamasına keçilir: ${String(err)}`,
      );
      ranked = await this.opts.fallbackSource.fetchTopByMarketCap(topN);
    }

    const eligible = ranked.filter((a) => !isExcludedAsset(a.baseSymbol));
    const activePairs = await this.opts.pairChecker.getActiveUsdtPairs();

    const universe: string[] = [];
    for (const asset of eligible) {
      if (universe.length >= maxAssets) break;
      const pair = `${asset.baseSymbol}USDT`;
      if (!activePairs.has(pair)) continue;
      if (asset.volumeUsd < minVolume) continue;
      universe.push(pair);
    }
    return universe;
  }

  private async selectTier2(tier1: string[]): Promise<string[]> {
    const cfg = this.opts.tier2;
    if (!cfg) return [];

    let ranked;
    try {
      ranked = await this.opts.primarySource.fetchTopByMarketCap(cfg.maxRank);
    } catch (err) {
      this.opts.onWarning?.(
        `Tier2 üçün CoinGecko əlçatan deyil, Binance həcm sıralamasına keçilir: ${String(err)}`,
      );
      ranked = await this.opts.fallbackSource.fetchTopByMarketCap(cfg.maxRank);
    }

    const eligible = ranked.filter((a) => !isExcludedAsset(a.baseSymbol));
    const activePairs = await this.opts.pairChecker.getActiveUsdtPairs();
    const tier1Set = new Set(tier1);

    const tier2: string[] = [];
    for (const asset of eligible) {
      if (tier2.length >= cfg.maxAssets) break;
      const pair = `${asset.baseSymbol}USDT`;
      if (tier1Set.has(pair)) continue;
      if (!activePairs.has(pair)) continue;
      if (asset.volumeUsd < cfg.minAvgDailyVolumeUsd) continue;
      tier2.push(pair);
    }
    return tier2;
  }
}
