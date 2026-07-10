import type { StrategyConfig } from "../config/index.js";
import type { LossLimitBreach } from "../risk/types.js";

// ===================================================================
// Sistem-səviyyəli state machine (sənəd, bölmə 9 və 7).
// Mərhələ 4-ün checkLossLimits-i YALNIZ "hansı limit pozulub?" sualına
// cavab verirdi — bura onun ÜZƏRİNƏ vaxt oxunur: nə vaxt bərpa olunsun?
// ===================================================================

export type SystemState = "RUNNING" | "PAUSED_DAILY" | "PAUSED_STREAK" | "HALTED";

export interface SystemStateInfo {
  state: SystemState;
  /** PAUSED_* üçün: bu vaxtdan (ms epoch) sonra avtomatik RUNNING-ə qayıdır. RUNNING/HALTED üçün null. */
  resumesAt: number | null;
  reason: LossLimitBreach;
}

export const INITIAL_SYSTEM_STATE: SystemStateInfo = { state: "RUNNING", resumesAt: null, reason: null };

function nextUtcMidnight(nowMs: number): number {
  const d = new Date(nowMs);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1, 0, 0, 0, 0);
}

/**
 * Növbəti bar bağlananda çağırılır. `nowMs` bazar (bar) vaxtıdır, real saat
 * deyil — paper trading REAL bazar datası ilə işlədiyi üçün bunlar praktikada
 * üst-üstə düşür, amma testlərdə determinizm üçün bar vaxtı istifadə edirik.
 *
 * HALTED-dan avtomatik çıxış YOXDUR (sənəd: "no continuation without user
 * approval") — yalnız xarici kod (istifadəçi təsdiqindən sonra) sıfırlaya bilər.
 */
export function evaluateSystemState(
  previous: SystemStateInfo,
  breach: LossLimitBreach,
  nowMs: number,
  config: StrategyConfig,
): SystemStateInfo {
  if (previous.state === "HALTED") return previous;

  if (previous.resumesAt !== null && nowMs < previous.resumesAt) {
    return previous; // hələ pauza dövründəyik — yeni pozuntu daha ağır olsa belə mövcud pauzanı gözləyirik
  }

  if (breach === "WEEKLY_HALT") {
    return { state: "HALTED", resumesAt: null, reason: "WEEKLY_HALT" };
  }
  if (breach === "DAILY_LOSS_LIMIT") {
    return { state: "PAUSED_DAILY", resumesAt: nextUtcMidnight(nowMs), reason: "DAILY_LOSS_LIMIT" };
  }
  if (breach === "CONSECUTIVE_LOSS_LIMIT") {
    return {
      state: "PAUSED_STREAK",
      resumesAt: nowMs + config.risk.streakPauseHours * 3_600_000,
      reason: "CONSECUTIVE_LOSS_LIMIT",
    };
  }

  return INITIAL_SYSTEM_STATE; // pauza vaxtı bitib və yeni pozuntu yoxdur → RUNNING-ə qayıt
}
