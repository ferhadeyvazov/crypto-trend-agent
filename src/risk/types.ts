import type { Tier } from "../universe/index.js";

// ===================================================================
// RiskManager tipləri (sənəd, bölmə 7-8).
// ===================================================================

export interface SizingResult {
  /** Base-asset vahidləri ilə pozisiya ölçüsü; rədd olunubsa 0 */
  positionSize: number;
  /** notional = positionSize * entryPrice */
  notional: number;
  riskAmount: number;
  stopDistance: number;
  /** Ölçüləndirmə rədd olunubsa səbəb (məs. minNotional-dan aşağıdır) */
  skipped: string | null;
}

export interface OpenPositionInfo {
  symbol: string;
  direction: "LONG" | "SHORT";
  /** BTC/ETH kimi "əsas" aktivlərdir? (korrelyasiya qaydası bunları xaric edir) */
  isCoreAsset: boolean;
  /** Bu pozisiyanın equity-ə nisbətən açıq riski, fraksiya (məs. 0.0075 = 0.75%) */
  openRiskPct: number;
  /** Giriş anında sabitlənmiş tier (bax: universe/types.ts) */
  tier: Tier;
}

export interface PortfolioCandidate {
  symbol: string;
  direction: "LONG" | "SHORT";
  isCoreAsset: boolean;
  adx4h: number;
  tier: Tier;
}

export interface PortfolioLimitResult {
  passed: boolean;
  failed: string[];
}

/** checkLossLimits-in mümkün nəticələri — heç biri pozulmayıbsa null. */
export type LossLimitBreach = "WEEKLY_HALT" | "DAILY_LOSS_LIMIT" | "CONSECUTIVE_LOSS_LIMIT" | null;
