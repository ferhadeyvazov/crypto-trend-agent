import type { StrategyConfig } from "../config/index.js";
import type { Regime } from "../signals/types.js";
import { computePositionSize } from "./sizing.js";
import { checkPortfolioLimits, isAdxSufficientForCandidate } from "./portfolioLimits.js";
import { checkLossLimits } from "./lossLimits.js";
import type { OpenPositionInfo, PortfolioCandidate, SizingResult } from "./types.js";

export interface RiskContext {
  equity: number;
  openPositions: OpenPositionInfo[];
  /** Exchange-in bu simvol üçün minimum notional-ı (order book/exchange-info mənbəyi hələ yoxdur — çağıran verir) */
  minNotional: number;
  btcRegime: Regime;
  dailyPnlPct: number;
  weeklyPnlPct: number;
  consecutiveLosses: number;
}

export interface RiskEvaluation {
  approved: boolean;
  sizing: SizingResult | null;
  /** Rədd səbəbləri — təsdiqlənibsə boşdur */
  rejected: string[];
}

/**
 * Bölmə 9-un "for s of queue: if portfolioLimitsOk(s): openPosition(s)"
 * addımının təcəssümü: zərər limitləri → BTC regime guard → portfel
 * limitləri (F5) → ölçüləndirmə (§7). Bunlardan hər hansı biri rədd
 * edərsə, sonrakılara baxılmır (ən bahalı yoxlama sona saxlanılıb).
 */
export function evaluateRisk(
  candidate: PortfolioCandidate,
  entry: { entryPrice: number; stopPrice: number },
  context: RiskContext,
  config: StrategyConfig,
): RiskEvaluation {
  const breach = checkLossLimits(context.dailyPnlPct, context.weeklyPnlPct, context.consecutiveLosses, config);
  if (breach) return { approved: false, sizing: null, rejected: [breach] };

  if (!isAdxSufficientForCandidate(candidate, context.btcRegime, config)) {
    return { approved: false, sizing: null, rejected: ["BTC_REGIME_GUARD_ADX"] };
  }

  const portfolioCheck = checkPortfolioLimits(candidate, context.openPositions, config);
  if (!portfolioCheck.passed) {
    return { approved: false, sizing: null, rejected: portfolioCheck.failed };
  }

  const sizing = computePositionSize(
    context.equity,
    entry.entryPrice,
    entry.stopPrice,
    context.minNotional,
    config,
    candidate.tier,
  );
  if (sizing.skipped) {
    return { approved: false, sizing, rejected: [sizing.skipped] };
  }

  return { approved: true, sizing, rejected: [] };
}
