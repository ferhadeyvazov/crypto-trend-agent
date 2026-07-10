import type { LogEvent, LogLevel, Logger } from "./types.js";

// ===================================================================
// Append-only JSONL logger. DataLayer konvensiyası ilə eyni: `now()` və
// yazma funksiyası (`write`) inject olunur — testlərdə fayla toxunmadan
// yoxlanıla bilsin.
// ===================================================================

export interface JsonlLoggerDeps {
  now: () => number;
  write: (line: string) => void;
}

export class JsonlLogger implements Logger {
  constructor(private deps: JsonlLoggerDeps) {}

  log(level: LogLevel, message: string, data?: Record<string, unknown>): void {
    const event: LogEvent = { ts: this.deps.now(), level, message, ...(data ? { data } : {}) };
    this.deps.write(JSON.stringify(event));
  }

  trade(message: string, data?: Record<string, unknown>): void {
    this.log("TRADE", message, data);
  }
  signal(message: string, data?: Record<string, unknown>): void {
    this.log("SIGNAL", message, data);
  }
  risk(message: string, data?: Record<string, unknown>): void {
    this.log("RISK", message, data);
  }
  warn(message: string, data?: Record<string, unknown>): void {
    this.log("WARN", message, data);
  }
  error(message: string, data?: Record<string, unknown>): void {
    this.log("ERROR", message, data);
  }
}
