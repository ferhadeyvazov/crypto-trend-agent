import type { MarketCapSource, RankedAsset } from "./types.js";

// ===================================================================
// Əsas mənbə (sənəd, bölmə 2): CoinGecko-nun açıq (açar tələb etməyən)
// /coins/markets endpoint-i — market cap-a görə artıq sıralanmış qaytarır.
// DataLayer konvensiyası ilə eyni: fetch inject olunur (testdə saxta).
// ===================================================================

export interface CoinGeckoSourceOptions {
  baseUrl?: string;
  fetchFn?: typeof fetch;
}

interface CoinGeckoMarketEntry {
  symbol: string;
  market_cap: number | null;
  total_volume: number | null;
}

export class CoinGeckoMarketCapSource implements MarketCapSource {
  private readonly baseUrl: string;
  private readonly fetchFn: typeof fetch;

  constructor(opts: CoinGeckoSourceOptions = {}) {
    this.baseUrl = opts.baseUrl ?? "https://api.coingecko.com/api/v3";
    this.fetchFn = opts.fetchFn ?? fetch;
  }

  async fetchTopByMarketCap(limit: number): Promise<RankedAsset[]> {
    const url =
      `${this.baseUrl}/coins/markets?vs_currency=usd&order=market_cap_desc` +
      `&per_page=${limit}&page=1&sparkline=false`;
    const res = await this.fetchFn(url);
    if (!res.ok) {
      throw new Error(`CoinGecko API xətası: HTTP ${res.status}`);
    }
    const data = (await res.json()) as CoinGeckoMarketEntry[];
    return data.map((d) => ({
      baseSymbol: d.symbol.toUpperCase(),
      marketCapUsd: d.market_cap ?? 0,
      volumeUsd: d.total_volume ?? 0,
    }));
  }
}
