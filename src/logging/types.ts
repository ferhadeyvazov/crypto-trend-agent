// ===================================================================
// Loglama tipləri (sənəd, bölmə 13): "TRADE (journal, Section 10.4),
// SIGNAL (every generated/rejected signal + reason code), RISK (limit
// violations), ERROR. All logs use UTC timestamps, append-only."
// WARN səviyyəsi sənəddə yoxdur, amma Universe modulunun CoinGecko→Binance
// fallback hadisəsini qeyd etmək üçün əlavə edilib (istifadəçi tələbi).
// ===================================================================

export type LogLevel = "TRADE" | "SIGNAL" | "RISK" | "WARN" | "ERROR";

export interface LogEvent {
  /** ms epoch, UTC */
  ts: number;
  level: LogLevel;
  message: string;
  data?: Record<string, unknown>;
}

export interface Logger {
  log(level: LogLevel, message: string, data?: Record<string, unknown>): void;
  trade(message: string, data?: Record<string, unknown>): void;
  signal(message: string, data?: Record<string, unknown>): void;
  risk(message: string, data?: Record<string, unknown>): void;
  warn(message: string, data?: Record<string, unknown>): void;
  error(message: string, data?: Record<string, unknown>): void;
}
