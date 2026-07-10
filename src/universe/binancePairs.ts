// ===================================================================
// Binance-də aktiv USDT cütlərinin siyahısı (sənəd, bölmə 2: "have a
// USDT (or USDC) pair on the target exchange"). Bütün exchangeInfo BİR
// dəfə çəkilib yaddaşda saxlanılır — hər namizəd üçün ayrı sorğu yerinə.
// ===================================================================

export interface BinancePairCheckerOptions {
  baseUrl?: string;
  fetchFn?: typeof fetch;
}

interface ExchangeInfoSymbol {
  symbol: string;
  status: string;
  quoteAsset: string;
}

export class BinancePairChecker {
  private readonly baseUrl: string;
  private readonly fetchFn: typeof fetch;
  private cachedActivePairs: Set<string> | null = null;

  constructor(opts: BinancePairCheckerOptions = {}) {
    this.baseUrl = opts.baseUrl ?? "https://api.binance.com";
    this.fetchFn = opts.fetchFn ?? fetch;
  }

  async getActiveUsdtPairs(): Promise<Set<string>> {
    if (this.cachedActivePairs) return this.cachedActivePairs;

    const url = `${this.baseUrl}/api/v3/exchangeInfo`;
    const res = await this.fetchFn(url);
    if (!res.ok) {
      throw new Error(`Binance exchangeInfo xətası: HTTP ${res.status}`);
    }
    const data = (await res.json()) as { symbols: ExchangeInfoSymbol[] };
    const active = new Set(
      data.symbols
        .filter((s) => s.status === "TRADING" && s.quoteAsset === "USDT")
        .map((s) => s.symbol),
    );
    this.cachedActivePairs = active;
    return active;
  }
}
