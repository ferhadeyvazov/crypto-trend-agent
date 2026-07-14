import type { DataLayer } from "../DataLayer.js";
import { type Candle, type Timeframe, TIMEFRAME_MS } from "../types.js";
import { filterClosed, assertNoGaps, isSaneCandle } from "../validation.js";
import { parseKlines, type RawKline } from "./parseKline.js";

// ===================================================================
// DataLayer-in Binance implementasiyası.
//
// Test edilə bilmə (testability) üçün dizayn: fetch, saat (now) və
// karantin müddəti konstruktordan inyeksiya olunur. Beləliklə unit
// testlərdə real interneta çıxmadan saxta fetch və saxta saat veririk.
// Bu, "dependency injection" adlanır və sənin NestJS/Spring təcrübənlə
// eyni prinsipdir.
// ===================================================================

export interface BinanceDataLayerOptions {
  baseUrl?: string;
  /** Cari vaxtı verən funksiya — testdə saxtalaşdırmaq üçün */
  now?: () => number;
  /** fetch implementasiyası — testdə saxtalaşdırmaq üçün */
  fetchFn?: typeof fetch;
  /** Gap-dən sonra karantin müddəti (saat). Defolt: config-dəki 24. */
  quarantineHours?: number;
  /** Retry parametrləri (sənəd, bölmə 13: exponential backoff) */
  maxRetries?: number;
  baseBackoffMs?: number;
  /** Keşin "təzə" sayıldığı müddət (ms). Eyni bar içində təkrar sorğu etməmək üçün. */
  cacheTtlMs?: number;
}

interface CacheEntry {
  candles: Candle[];
  fetchedAt: number;
}

export class BinanceDataLayer implements DataLayer {
  private readonly baseUrl: string;
  private readonly now: () => number;
  private readonly fetchFn: typeof fetch;
  private readonly quarantineMs: number;
  private readonly maxRetries: number;
  private readonly baseBackoffMs: number;
  private readonly cacheTtlMs: number;

  /** symbol → karantinin bitmə vaxtı (ms epoch) */
  private readonly quarantine = new Map<string, number>();
  /** "symbol|timeframe|limit" → keş */
  private readonly cache = new Map<string, CacheEntry>();

  constructor(opts: BinanceDataLayerOptions = {}) {
    this.baseUrl = opts.baseUrl ?? "https://api.binance.com";
    this.now = opts.now ?? (() => Date.now());
    this.fetchFn = opts.fetchFn ?? fetch;
    this.quarantineMs = (opts.quarantineHours ?? 24) * 3_600_000;
    this.maxRetries = opts.maxRetries ?? 4;
    this.baseBackoffMs = opts.baseBackoffMs ?? 1000;
    this.cacheTtlMs = opts.cacheTtlMs ?? 30_000;
  }

  isQuarantined(symbol: string): boolean {
    const until = this.quarantine.get(symbol);
    if (until === undefined) return false;
    if (this.now() >= until) {
      this.quarantine.delete(symbol); // müddət bitib — karantindən çıxart
      return false;
    }
    return true;
  }

  async getClosedCandles(
    symbol: string,
    timeframe: Timeframe,
    limit: number,
  ): Promise<Candle[]> {
    if (this.isQuarantined(symbol)) {
      throw new Error(
        `${symbol} karantindədir (data gap). Karantindəki aktivlə işləmək qadağandır.`,
      );
    }

    const cacheKey = `${symbol}|${timeframe}|${limit}`;
    const cached = this.cache.get(cacheKey);
    if (cached && this.now() - cached.fetchedAt < this.cacheTtlMs) {
      return cached.candles;
    }

    // +2 şam artıq istəyirik: sonuncu şam adətən bağlanmamış olur,
    // onu atandan sonra da `limit` qədər şam qalsın.
    const raw = await this.fetchKlines(symbol, timeframe, limit + 2);
    const parsed = parseKlines(raw);

    // 1) Yalnız bağlanmış şamlar (repainting qadağası)
    const closed = filterClosed(parsed, this.now());

    // 2) Zədəli şam yoxlaması
    const broken = closed.find((c) => !isSaneCandle(c));
    if (broken) {
      this.putInQuarantine(symbol);
      throw new Error(
        `${symbol}: zədəli şam aşkarlandı (openTime=${broken.openTime}). Aktiv karantinə salındı.`,
      );
    }

    // 3) Gap yoxlaması — tapılarsa karantin + xəta (sənəd, bölmə 3)
    try {
      assertNoGaps(closed, symbol, timeframe);
    } catch (err) {
      this.putInQuarantine(symbol);
      throw err;
    }

    const result = closed.slice(-limit);
    this.cache.set(cacheKey, { candles: result, fetchedAt: this.now() });
    return result;
  }

  /**
   * Son keşlənmiş bağlanmış 1h şamın close qiyməti (dashboard-ın `/api/positions`
   * unrealizedPnl hesablaması üçün, Mərhələ 2) — keşdə yoxdursa `null`.
   */
  getCachedClose(symbol: string): number | null {
    let latest: Candle | null = null;
    for (const [key, entry] of this.cache) {
      if (!key.startsWith(`${symbol}|1h|`)) continue;
      const candle = entry.candles[entry.candles.length - 1];
      if (candle && (!latest || candle.closeTime > latest.closeTime)) {
        latest = candle;
      }
    }
    return latest ? latest.close : null;
  }

  private putInQuarantine(symbol: string): void {
    this.quarantine.set(symbol, this.now() + this.quarantineMs);
  }

  /**
   * Binance klines sorğusu + exponential backoff (sənəd, bölmə 13:
   * 1s → 2s → 4s ... max 60s). Rate limit (429/418) və şəbəkə xətalarında
   * təkrar cəhd edir; digər HTTP xətalarında dərhal partlayır.
   */
  private async fetchKlines(
    symbol: string,
    timeframe: Timeframe,
    limit: number,
  ): Promise<RawKline[]> {
    const url =
      `${this.baseUrl}/api/v3/klines?symbol=${encodeURIComponent(symbol)}` +
      `&interval=${timeframe}&limit=${limit}`;

    let lastError: unknown;
    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      if (attempt > 0) {
        const backoff = Math.min(this.baseBackoffMs * 2 ** (attempt - 1), 60_000);
        await sleep(backoff);
      }
      try {
        const res = await this.fetchFn(url);
        if (res.ok) {
          return (await res.json()) as RawKline[];
        }
        if (res.status === 429 || res.status === 418) {
          // Rate limit — gözləyib təkrar cəhd edirik
          lastError = new Error(`Binance rate limit: HTTP ${res.status}`);
          continue;
        }
        // Digər HTTP xətaları retry ilə düzəlməyəcək
        throw new Error(`Binance API xətası: HTTP ${res.status} (${url})`);
      } catch (err) {
        lastError = err;
        // Şəbəkə xətası — növbəti cəhdə keçirik
      }
    }
    throw new Error(
      `${symbol} ${timeframe}: ${this.maxRetries + 1} cəhddən sonra data alınmadı. ` +
        `Son xəta: ${String(lastError)}`,
    );
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Köməkçi: verilən timeframe-də hazırda formalaşan şamın openTime-ı */
export function currentBarOpenTime(nowMs: number, timeframe: Timeframe): number {
  const step = TIMEFRAME_MS[timeframe];
  return Math.floor(nowMs / step) * step;
}
