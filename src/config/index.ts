// Konfiqurasiya yükləyicisi.
// Sənədin 12-ci bölməsi deyir: bu JSON sistemin "source of truth"-udur.
// Bütün modullar parametrləri YALNIZ buradan oxuyur — kodda "sehrli rəqəm" olmur.
import rawConfig from "./strategy.v1.json" with { type: "json" };

export interface StrategyConfig {
  system: {
    name: string;
    version: string;
    mode: "PAPER_TRADING" | "LIVE";
    allowShort: boolean;
    baseCurrency: string;
  };
  timeframes: { trend: "4h"; execution: "1h"; minHistoryBars: number };
  indicators: {
    ema_fast_4h: number;
    ema_slow_4h: number;
    adx_4h: { period: number; minLong: number; minAltWhenBtcWeak: number };
    emaSlopeLookback: number;
    ema_pullback_1h: number;
    rsi_1h: { period: number; min: number; max: number };
    macd_1h: [number, number, number];
    donchian_1h: number;
    atr_1h: { period: number; avgPeriod: number; minRatio: number };
    volumeSma_1h: number;
    breakoutVolumeMult: number;
    maxBarRangeAtrMult: number;
    pullbackMaxDepthAtrMult: number;
  };
  entry: {
    types: string[];
    maxSpreadBps: number;
    cooldownBars1h: number;
    pyramiding: boolean;
  };
  risk: {
    riskPerTrade: number;
    maxNotionalPctPerPosition: number;
    leverage: number;
    dailyLossLimitPct: number;
    maxConsecutiveLosses: number;
    streakPauseHours: number;
    weeklyHaltLossPct: number;
  };
  portfolio: {
    maxOpenPositions: number;
    maxTotalOpenRiskPct: number;
    maxSameDirectionAltcoins: number;
    signalPriority: string;
  };
  ops: {
    evaluateOnBarClose: boolean;
    stopOrdersOnExchange: boolean;
    quarantineOnDataGapHours: number;
    reportSchedule: string;
    onUncertainty: string;
  };
  // Qeyd: qalan bölmələrin (exit, paperTrading, goLiveCriteria...) dəqiq
  // tipləri öz modulları yazılanda (Mərhələ 5-6) buraya əlavə olunacaq.
  [key: string]: unknown;
}

export const config = rawConfig as unknown as StrategyConfig;
