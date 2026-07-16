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

  /**
   * Tier1 və Tier2 EYNİ ranked siyahıdan (bir fetchTopByMarketCap çağırışından)
   * törəyir — ayrı-ayrı sorğu getmir (əvvəllər hər ikisi öz sorğusunu atırdı,
   * bu həm API kvotasını 2x sərf edirdi, həm CoinGecko kəsiləndə fallback-ı da
   * 2x işə salırdı). Tier1-in NƏTİCƏSİ dəyişməz qalır: `ranked.slice(0, topN)`
   * dəqiq `fetchTopByMarketCap(topN)`-in özünün qaytaracağı ilə eynidir (topN,
   * fetchLimit-in İÇİNDƏDİR), sadəcə indi hər iki tier eyni "an"ın (snapshot)
   * datasından oxuyur.
   */
  async selectUniverse(): Promise<UniverseSelectionResult> {
    const topN = this.opts.topN ?? 30;
    const maxAssets = this.opts.maxAssets ?? 20;
    const minVolume = this.opts.minAvgDailyVolumeUsd ?? 50_000_000;
    const tier2Cfg = this.opts.tier2;
    const fetchLimit = tier2Cfg ? Math.max(topN, tier2Cfg.maxRank) : topN;

    const ranked = await this.fetchRanked(fetchLimit);
    const activePairs = await this.opts.pairChecker.getActiveUsdtPairs();

    const tier1Eligible = ranked.slice(0, topN).filter((a) => !isExcludedAsset(a.baseSymbol));
    const tier1 = this.pickPairs(tier1Eligible, activePairs, maxAssets, minVolume);

    let tier2: string[] = [];
    if (tier2Cfg) {
      const tier2Eligible = ranked.filter((a) => !isExcludedAsset(a.baseSymbol));
      tier2 = this.pickPairs(tier2Eligible, activePairs, tier2Cfg.maxAssets, tier2Cfg.minAvgDailyVolumeUsd, new Set(tier1));
    }

    const tierMap: Record<string, Tier> = {};
    for (const pair of tier1) tierMap[pair] = "TIER1";
    for (const pair of tier2) tierMap[pair] = "TIER2";

    return { universe: [...tier1, ...tier2], tierMap };
  }

  private async fetchRanked(limit: number) {
    try {
      return await this.opts.primarySource.fetchTopByMarketCap(limit);
    } catch (err) {
      this.opts.onWarning?.(
        `CoinGecko əlçatan deyil, Binance həcm sıralamasına keçilir: ${String(err)}`,
      );
      return await this.opts.fallbackSource.fetchTopByMarketCap(limit);
    }
  }

  private pickPairs(
    eligible: { baseSymbol: string; volumeUsd: number }[],
    activePairs: Set<string>,
    maxAssets: number,
    minVolume: number,
    exclude: Set<string> = new Set(),
  ): string[] {
    const picked: string[] = [];
    for (const asset of eligible) {
      if (picked.length >= maxAssets) break;
      const pair = `${asset.baseSymbol}USDT`;
      if (exclude.has(pair)) continue;
      if (!activePairs.has(pair)) continue;
      if (asset.volumeUsd < minVolume) continue;
      picked.push(pair);
    }
    return picked;
  }
}
