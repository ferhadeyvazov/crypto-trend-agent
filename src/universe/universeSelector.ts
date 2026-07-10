import { isExcludedAsset } from "./exclusionList.js";
import type { MarketCapSource } from "./types.js";
import type { BinancePairChecker } from "./binancePairs.js";

// ===================================================================
// Universe seçimi (sənəd, bölmə 2): top 30 market cap → stablecoin/wrapped
// xaric → Binance USDT cütü mövcud olmalı → həcm ≥ minAvgDailyVolumeUsd
// → ilk 20. Hər həftə bazar ertəsi 00:00 UTC-də yenidən qurulur (bunu
// çağıran — main.ts-in scheduler-i — idarə edir, bu sinif təkcə BİR dəfəlik
// seçimi edir).
// ===================================================================

export interface UniverseSelectorOptions {
  primarySource: MarketCapSource;
  fallbackSource: MarketCapSource;
  pairChecker: BinancePairChecker;
  /** CoinGecko əlçatmaz olub fallback-a keçiləndə çağırılır (WARN logu üçün) */
  onWarning?: (message: string) => void;
  topN?: number;
  maxAssets?: number;
  minAvgDailyVolumeUsd?: number;
}

export class UniverseSelector {
  constructor(private opts: UniverseSelectorOptions) {}

  async selectUniverse(): Promise<string[]> {
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
}
