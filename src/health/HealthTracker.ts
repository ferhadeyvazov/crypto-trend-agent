import type { Logger, LogLevel } from "../logging/index.js";

// ===================================================================
// Dashboard `/api/health` üçün (Mərhələ 2, Mərhələ 7). Mövcud `Logger`-i
// decorate edir — ERROR hadisələrini yaddaşda (ring-buffer) saxlayır, əsl
// logger-ə (JsonlLogger) toxunmadan ötürür. Bundan başqa hər dövrənin
// (runCycle) bitmə vaxtını izləyir ("son fetch" göstəricisi üçün —
// DataLayer-in per-simvol fetch vaxtları public deyil, dövrə-səviyyəli
// təxmin kifayətdir).
//
// Mərhələ 7: ikinci, DAHA GENİŞ ring-buffer (`recentEvents`) — HAMISI
// (TRADE/SIGNAL/RISK/WARN/ERROR) qeyd olunur, "/api/health"-in "Recent
// log" bölməsi üçün. `recentErrors` bundan AYRIDIR və toxunulmayıb —
// `criticalErrorCount30d` hesablaması ona etibar edir.
// ===================================================================

interface LoggedEntry {
  ts: number;
  level: LogLevel;
  message: string;
}

export interface HealthTrackerDeps {
  now: () => number;
  maxRecentErrors?: number;
  maxRecentEvents?: number;
}

export class HealthTracker implements Logger {
  private readonly recentErrors: LoggedEntry[] = [];
  private readonly recentEvents: LoggedEntry[] = [];
  private readonly maxRecentErrors: number;
  private readonly maxRecentEvents: number;
  private lastCycleCompletedAt: number | null = null;

  constructor(private readonly inner: Logger, private readonly deps: HealthTrackerDeps) {
    this.maxRecentErrors = deps.maxRecentErrors ?? 50;
    this.maxRecentEvents = deps.maxRecentEvents ?? 50;
  }

  private record(level: LogLevel, message: string): void {
    const entry: LoggedEntry = { ts: this.deps.now(), level, message };
    this.recentEvents.push(entry);
    if (this.recentEvents.length > this.maxRecentEvents) this.recentEvents.shift();
    if (level === "ERROR") {
      this.recentErrors.push(entry);
      if (this.recentErrors.length > this.maxRecentErrors) this.recentErrors.shift();
    }
  }

  log(level: LogLevel, message: string, data?: Record<string, unknown>): void {
    this.record(level, message);
    this.inner.log(level, message, data);
  }
  trade(message: string, data?: Record<string, unknown>): void {
    this.record("TRADE", message);
    this.inner.trade(message, data);
  }
  signal(message: string, data?: Record<string, unknown>): void {
    this.record("SIGNAL", message);
    this.inner.signal(message, data);
  }
  risk(message: string, data?: Record<string, unknown>): void {
    this.record("RISK", message);
    this.inner.risk(message, data);
  }
  warn(message: string, data?: Record<string, unknown>): void {
    this.record("WARN", message);
    this.inner.warn(message, data);
  }
  error(message: string, data?: Record<string, unknown>): void {
    this.record("ERROR", message);
    this.inner.error(message, data);
  }

  recordCycleCompleted(now: number): void {
    this.lastCycleCompletedAt = now;
  }

  getLastCycleCompletedAt(): number | null {
    return this.lastCycleCompletedAt;
  }

  /** `sinceMs`-dən bəri baş vermiş ERROR sayı (məs. `/api/metrics`-in criticalErrorCount30d-i üçün). */
  getErrorCountSince(sinceMs: number): number {
    return this.recentErrors.filter((e) => e.ts >= sinceMs).length;
  }

  getRecentErrorMessages(limit = 10): string[] {
    return this.recentErrors.slice(-limit).map((e) => `${new Date(e.ts).toISOString()}: ${e.message}`);
  }

  /** Bütün səviyyələr (TRADE/SIGNAL/RISK/WARN/ERROR) — `/api/health`-in "Recent log" bölməsi. */
  getRecentEvents(limit = 10): string[] {
    return this.recentEvents.slice(-limit).map((e) => `${new Date(e.ts).toISOString()} ${e.level} ${e.message}`);
  }

  /** Dövrələr gözlənilən aralıqdan (defolt 2 saat) çox gecikibsə "stalled". */
  getSchedulerStatus(nowMs: number, staleThresholdMs = 2 * 3_600_000): "running" | "stalled" {
    if (this.lastCycleCompletedAt === null) return "running";
    return nowMs - this.lastCycleCompletedAt > staleThresholdMs ? "stalled" : "running";
  }
}
