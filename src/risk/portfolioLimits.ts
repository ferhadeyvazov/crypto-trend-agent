import type { StrategyConfig } from "../config/index.js";
import type { Regime } from "../signals/types.js";
import type { OpenPositionInfo, PortfolioCandidate, PortfolioLimitResult } from "./types.js";

// ===================================================================
// Portfel-səviyyəli limitlər (sənəd, bölmə 8 / F5).
// SignalEngine (Mərhələ 3) bunları YOXLAMIR — asset-səviyyəli F1-F4-dən
// fərqli olaraq, bunlar BÜTÜN açıq pozisiyaların BİRGƏ vəziyyətini bilməyi
// tələb edir, ona görə RiskManager-in işidir (bölmə 9-un pseudokodunda
// ayrıca `portfolioLimitsOk()` addımı kimi göstərilib).
// ===================================================================

/**
 * Bir pozisiyanın equity-ə nisbətən açıq riski (fraksiya). `runCycle.ts`-də F5
 * yoxlaması üçün, storage-adapter-də isə `/api/portfolio` risk məruzəsi üçün
 * istifadə olunur — iki yerdə düstur təkrarlanmasın deyə çıxarılıb.
 * `referencePrice`: pozisiyanın entryPrice-ı hələ fill olmayıbsa (PENDING_ENTRY,
 * entryPrice=null) istifadə olunacaq anchor qiymət (çağıran verir).
 */
export function computeOpenRiskPct(
  position: { originalSize: number; entryPrice: number | null; initialStop: number },
  referencePrice: number,
  equity: number,
): number {
  if (equity <= 0) return 0;
  const anchorPrice = position.entryPrice ?? referencePrice;
  return (position.originalSize * Math.abs(anchorPrice - position.initialStop)) / equity;
}

export function checkPortfolioLimits(
  candidate: PortfolioCandidate,
  openPositions: OpenPositionInfo[],
  config: StrategyConfig,
): PortfolioLimitResult {
  const failed: string[] = [];

  if (openPositions.length >= config.portfolio.maxOpenPositions) {
    failed.push("F5_MAX_OPEN_POSITIONS");
  }

  const totalOpenRisk = openPositions.reduce((sum, p) => sum + p.openRiskPct, 0) + config.risk.riskPerTrade;
  if (totalOpenRisk > config.portfolio.maxTotalOpenRiskPct / 100) {
    failed.push("F5_MAX_TOTAL_OPEN_RISK");
  }

  // Korrelyasiya qaydası: BTC/ETH xaric, eyni istiqamətdə maks N altcoin pozisiyası
  if (!candidate.isCoreAsset) {
    const sameDirectionAltcoins = openPositions.filter(
      (p) => !p.isCoreAsset && p.direction === candidate.direction,
    ).length;
    if (sameDirectionAltcoins >= config.portfolio.maxSameDirectionAltcoins) {
      failed.push("F5_CORRELATION_LIMIT");
    }
  }

  return { passed: failed.length === 0, failed };
}

/**
 * BTC regime guard (bölmə 8): BTC-nin 4h rejimi zəifdirsə (SHORT_ONLY/NO_TRADE),
 * altcoin LONG girişləri üçün ADX tələbi minLong-dan (23) minAltWhenBtcWeak-a
 * (28) qalxır. BTC/ETH-in özü (isCoreAsset) bu qaydadan təsirlənmir.
 */
export function isAdxSufficientForCandidate(
  candidate: Pick<PortfolioCandidate, "isCoreAsset" | "direction" | "adx4h">,
  btcRegime: Regime,
  config: StrategyConfig,
): boolean {
  const btcWeak = btcRegime === "SHORT_ONLY" || btcRegime === "NO_TRADE";
  const guardActive = !candidate.isCoreAsset && candidate.direction === "LONG" && btcWeak;
  const minAdx = guardActive ? config.indicators.adx_4h.minAltWhenBtcWeak : config.indicators.adx_4h.minLong;
  return candidate.adx4h >= minAdx;
}
