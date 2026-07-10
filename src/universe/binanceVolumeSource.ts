import type { MarketCapSource, RankedAsset } from "./types.js";

// ===================================================================
// Fallback mənbə: CoinGecko əlçatan olmayanda (rate-limit, timeout, xəta)
// istifadə olunur. DİQQƏT: bu, market cap DEYİL — Binance-in USDT cütləri
// üzrə 24h dollar həcminə görə sıralamadır. Sənədin bölmə 2 tələbindən
// (market cap) kənarlaşmadır, YALNIZ CoinGecko əlçatmaz olanda işə düşür
// və çağıran tərəfindən WARN səviyyəsində loglanmalıdır.
// ===================================================================

export interface BinanceVolumeSourceOptions {
  baseUrl?: string;
  fetchFn?: typeof fetch;
}

interface BinanceTicker24hr {
  symbol: string;
  quoteVolume: string;
}

export class BinanceVolumeSource implements MarketCapSource {
  private readonly baseUrl: string;
  private readonly fetchFn: typeof fetch;

  constructor(opts: BinanceVolumeSourceOptions = {}) {
    this.baseUrl = opts.baseUrl ?? "https://api.binance.com";
    this.fetchFn = opts.fetchFn ?? fetch;
  }

  async fetchTopByMarketCap(limit: number): Promise<RankedAsset[]> {
    const url = `${this.baseUrl}/api/v3/ticker/24hr`;
    const res = await this.fetchFn(url);
    if (!res.ok) {
      throw new Error(`Binance 24hr ticker xətası: HTTP ${res.status}`);
    }
    const data = (await res.json()) as BinanceTicker24hr[];
    return data
      .filter((d) => d.symbol.endsWith("USDT"))
      .map((d) => ({
        baseSymbol: d.symbol.slice(0, -4),
        marketCapUsd: 0, // bu mənbə ilə market cap məlum deyil
        volumeUsd: Number(d.quoteVolume) || 0,
      }))
      .sort((a, b) => b.volumeUsd - a.volumeUsd)
      .slice(0, limit);
  }
}
