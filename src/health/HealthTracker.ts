import type { Logger, LogLevel } from "../logging/index.js";

// ===================================================================
// Dashboard `/api/health` üçün (Mərhələ 2). Mövcud `Logger`-i decorate
// edir — ERROR hadisələrini yaddaşda (ring-buffer) saxlayır, əsl logger-ə
// (JsonlLogger) toxunmadan ötürür. Bundan başqa hər dövrənin (runCycle)
// bitmə vaxtını izləyir ("son fetch" göstəricisi üçün — DataLayer-in
// per-simvol fetch vaxtları public deyil, dövrə-səviyyəli təxmin kifayətdir).
// ===================================================================

interface ErrorEntry {
  ts: number;
  message: string;
}

export interface HealthTrackerDeps {
  now: () => number;
  maxRecentErrors?: number;
}

export class HealthTracker implements Logger {
  private readonly recentErrors: ErrorEntry[] = [];
  private readonly maxRecentErrors: number;
  private lastCycleCompletedAt: number | null = null;

  constructor(private readonly inner: Logger, private readonly deps: HealthTrackerDeps) {
    this.maxRecentErrors = deps.maxRecentErrors ?? 50;
  }

  log(level: LogLevel, message: string, data?: Record<string, unknown>): void {
    this.inner.log(level, message, data);
  }
  trade(message: string, data?: Record<string, unknown>): void {
    this.inner.trade(message, data);
  }
  signal(message: string, data?: Record<string, unknown>): void {
    this.inner.signal(message, data);
  }
  risk(message: string, data?: Record<string, unknown>): void {
    this.inner.risk(message, data);
  }
  warn(message: string, data?: Record<string, unknown>): void {
    this.inner.warn(message, data);
  }
  error(message: string, data?: Record<string, unknown>): void {
    this.recentErrors.push({ ts: this.deps.now(), message });
    if (this.recentErrors.length > this.maxRecentErrors) this.recentErrors.shift();
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

  /** Dövrələr gözlənilən aralıqdan (defolt 2 saat) çox gecikibsə "stalled". */
  getSchedulerStatus(nowMs: number, staleThresholdMs = 2 * 3_600_000): "running" | "stalled" {
    if (this.lastCycleCompletedAt === null) return "running";
    return nowMs - this.lastCycleCompletedAt > staleThresholdMs ? "stalled" : "running";
  }
}
