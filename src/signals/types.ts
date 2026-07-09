// ===================================================================
// SignalEngine tipləri (sənəd, bölmə 2, 4, 5).
// Regime: 4h-da hesablanan "strateji istiqamət". EntrySignal: 1h-da
// yaranan "taktiki giriş" təklifi — RiskManager (Mərhələ 4) bunu
// ölçüləndirib təsdiqləyəcək və ya rədd edəcək.
// ===================================================================

export type Regime = "LONG_ONLY" | "SHORT_ONLY" | "NO_TRADE";
export type SignalDirection = "LONG" | "SHORT";
export type EntrySignalType = "PULLBACK" | "BREAKOUT";

export interface EntrySignal {
  type: EntrySignalType;
  direction: SignalDirection;
  /** Siqnalın yarandığı şam indeksi (giriş candles massivində) */
  index: number;
}

/**
 * F1–F4 filtr yoxlaması üçün lazım olan xarici kontekst (sənəd, bölmə 5.3).
 * F5 (bölmə 8, portfel limitləri) bura daxil deyil — bölmə 9-un
 * pseudokodunda ayrıca `portfolioLimitsOk()` addımı kimi göstərilib,
 * bunu RiskManager (Mərhələ 4) tətbiq edəcək.
 */
export interface FilterContext {
  /** Cari bid-ask spread, baza puanla (F2). Order book mənbəyi hələ yoxdur — çağıran tərəf verir. */
  spreadBps: number;
  /** Bu aktivdə artıq açıq pozisiya varmı? (F3) */
  hasOpenPosition: boolean;
  /** Son bağlanmış trade-dən bu yana keçən tam 1h şam sayı; heç trade olmayıbsa null (F4) */
  barsSinceLastTrade: number | null;
}

export interface FilterResult {
  passed: boolean;
  /** Rədd səbəbləri (reason code-lar — sənəd bölmə 13-ün "SIGNAL" logu üçün nəzərdə tutulub) */
  failed: string[];
}
