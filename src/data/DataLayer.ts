import type { Candle, Timeframe } from "./types.js";

// ===================================================================
// DataLayer interfeysi — SignalEngine-in bazara "pəncərəsi".
// -------------------------------------------------------------------
// Ən vacib dizayn qərarı: interfeys BAĞLANMAMIŞ şamı qaytara BİLMİR.
// Sənəd (bölmə 1 və 3) deyir: siqnallar yalnız bağlanmış şamlarla
// hesablana bilər (repainting problemi). Bunu "parametrlə" həll etmək
// əvəzinə (məs. includeUnclosed: boolean) dizaynla həll edirik:
// metodun adı və müqaviləsi elə qurulub ki, SignalEngine-i yazan adam
// səhv etmək İMKANINA malik deyil. Təhlükəsizlik defolt olmalıdır.
// ===================================================================

export interface DataLayer {
  /**
   * Verilən aktiv və timeframe üçün son `limit` sayda YALNIZ BAĞLANMIŞ
   * şamı qaytarır (köhnədən yeniyə sıralanmış).
   *
   * Zəmanətlər:
   *  - Massivdəki hər şamın closeTime-ı "indi"dən kiçikdir (bağlanıb).
   *  - Şamlar arasında gap yoxdur — gap aşkarlanarsa DataGapError atılır
   *    və aktiv karantinə salınır (sənəd, bölmə 3: 24 saat).
   *
   * @param symbol    məs. "BTCUSDT"
   * @param timeframe "1h" | "4h"
   * @param limit     neçə şam (minimum config.timeframes.minHistoryBars = 300)
   */
  getClosedCandles(
    symbol: string,
    timeframe: Timeframe,
    limit: number,
  ): Promise<Candle[]>;

  /**
   * Aktiv hazırda karantindədirmi? (data gap-dən sonra 24 saat)
   * RiskManager/SignalEngine karantindəki aktivlə İŞLƏMİR.
   */
  isQuarantined(symbol: string): boolean;
}
