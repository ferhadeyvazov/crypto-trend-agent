// ===================================================================
// Əsas data tipləri
// -------------------------------------------------------------------
// Dizayn qərarı: vaxt üçün Date YOX, number (millisaniyə epoch) istifadə
// edirik. Səbəblər:
//   1. Binance API vaxtı onsuz da ms epoch kimi qaytarır (məs. 1720512000000)
//      — çevirməyə ehtiyac qalmır, çevirmə = potensial səhv mənbəyi.
//   2. JSON.stringify(Date) → string olur; geri oxuyanda Date yox, string
//      alırsan. Keşləmə/jurnal üçün number problemsizdir.
//   3. Müqayisə və hesab (a.openTime + TIMEFRAME_MS) number ilə birbaşadır.
// ===================================================================

export type Timeframe = "1h" | "4h";

/** Hər timeframe-in millisaniyə ilə uzunluğu. Gap yoxlamasında istifadə olunur. */
export const TIMEFRAME_MS: Record<Timeframe, number> = {
  "1h": 3_600_000,
  "4h": 14_400_000,
};

/**
 * Bir şam (candle). Sənədin 3-cü bölməsindəki OHLCV formatı:
 * open, high, low, close, volume, closeTime — üstəlik openTime.
 *
 * openTime niyə lazımdır? Gap (çatışmayan şam) yoxlaması üçün:
 * növbəti şamın openTime-ı = əvvəlkinin openTime-ı + timeframe olmalıdır.
 */
export interface Candle {
  /** Şamın açılış vaxtı, ms epoch (UTC) */
  openTime: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  /** Şamın bağlanış vaxtı, ms epoch (UTC). Binance: openTime + tf - 1ms */
  closeTime: number;
}

/** Data bütövlüyü pozulanda (gap) atılan xəta — asset karantinə düşür. */
export class DataGapError extends Error {
  constructor(
    public readonly symbol: string,
    public readonly timeframe: Timeframe,
    public readonly expectedOpenTime: number,
    public readonly actualOpenTime: number,
  ) {
    super(
      `Data gap: ${symbol} ${timeframe} — gözlənilən openTime=${expectedOpenTime}, ` +
        `gələn=${actualOpenTime}. Səhv data ilə siqnal hesablamaq qadağandır (sənəd, bölmə 3).`,
    );
    this.name = "DataGapError";
  }
}
