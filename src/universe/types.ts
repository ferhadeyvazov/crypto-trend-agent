// ===================================================================
// Universe modulu tipləri (sənəd, bölmə 2).
// ===================================================================

export interface RankedAsset {
  /** Baza aktiv simvolu, böyük hərflərlə (məs. "BTC", "SOL") — hələ trading pair deyil */
  baseSymbol: string;
  marketCapUsd: number;
  /**
   * Təxmini gündəlik dollar həcmi. Qeyd: sənəd "average daily volume over
   * the last 30 days" tələb edir — biz bunun əvəzinə mənbənin verdiyi ƏN SON
   * 24h həcmini YAXINLAŞMA kimi istifadə edirik (dəqiq 30-günlük hərəkətli
   * orta hesablamaq DataLayer-in hazırkı 1h/4h əhatəsindən kənara çıxan
   * əlavə tarixi sorğular tələb edir). Bu təxmini şərh açıq şəkildə qeyd olunur.
   */
  volumeUsd: number;
}

export interface MarketCapSource {
  /** Market cap-a görə azalan sırada, ən çox `limit` aktiv qaytarır */
  fetchTopByMarketCap(limit: number): Promise<RankedAsset[]>;
}
