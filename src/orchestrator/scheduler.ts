// ===================================================================
// Zaman hesablamaları (main.ts-in scheduler-i üçün) — xalis funksiyalar,
// testlə doğrulana bilsin deyə runCycle-in özündən ayrı saxlanılıb.
// ===================================================================

/** Növbəti tam UTC saatına neçə millisaniyə qalıb (bar bağlanışının Binance-də görünməsi üçün kiçik bufer əlavə olunur). */
export function msUntilNextHour(nowMs: number, bufferMs = 5000): number {
  const HOUR = 3_600_000;
  const next = Math.ceil((nowMs + 1) / HOUR) * HOUR;
  return next - nowMs + bufferMs;
}

/** Verilən vaxtdan geriyə doğru ən yaxın Bazar ertəsi 00:00 UTC-nin ms epoch-u. */
export function mostRecentMonday00Utc(nowMs: number): number {
  const d = new Date(nowMs);
  const dayOfWeek = (d.getUTCDay() + 6) % 7; // Bazar ertəsi = 0
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - dayOfWeek);
}

/** Universe yenidən qurulmalıdır? (sənəd, bölmə 2: "weekly-monday-00:00-UTC"). */
export function shouldRebalanceUniverse(lastRebalanceAt: number | null, nowMs: number): boolean {
  if (lastRebalanceAt === null) return true;
  return lastRebalanceAt < mostRecentMonday00Utc(nowMs);
}
