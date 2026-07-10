import type { StrategyConfig } from "../config/index.js";
import type { LossLimitBreach } from "./types.js";

// ===================================================================
// Gündəlik/ardıcıl/həftəlik zərər limitlərinin AŞKARLANMASI (sənəd, bölmə 7).
// Bu, yalnız "hansı limit pozulub?" sualına cavab verən xalis funksiyadır.
// NƏ VAXT bərpa olunacağı (12 saat gözləmə, UTC gün dəyişimi) real saat və
// state persistence tələb edir — bunu ExecutionEngine (Mərhələ 5) öz state
// machine-ində (bölmə 9: RUNNING/PAUSED_DAILY/PAUSED_STREAK/HALTED) idarə edəcək.
//
// Vahid qeydi: dailyPnlPct/weeklyPnlPct faiz PUANI ilə verilir (config-dəki
// dailyLossLimitPct=3.0 kimi eyni vahid) — -3.5 = equity-nin 3.5%-i itirilib.
// ===================================================================

export function checkLossLimits(
  dailyPnlPct: number,
  weeklyPnlPct: number,
  consecutiveLosses: number,
  config: StrategyConfig,
): LossLimitBreach {
  // Ən ağır olandan başlayaraq yoxlanılır — HALT digər pauzaları önə keçir
  if (weeklyPnlPct <= -config.risk.weeklyHaltLossPct) return "WEEKLY_HALT";
  if (dailyPnlPct <= -config.risk.dailyLossLimitPct) return "DAILY_LOSS_LIMIT";
  if (consecutiveLosses >= config.risk.maxConsecutiveLosses) return "CONSECUTIVE_LOSS_LIMIT";
  return null;
}
