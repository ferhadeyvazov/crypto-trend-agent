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
  ops: {
    evaluateOnBarClose: boolean;
    stopOrdersOnExchange: boolean;
    quarantineOnDataGapHours: number;
    reportSchedule: string;
    onUncertainty: string;
  };
  // Qeyd: qalan bölmələrin (indicators, risk, exit...) dəqiq tipləri
  // öz modulları yazılanda (Mərhələ 2-4) buraya əlavə olunacaq.
  [key: string]: unknown;
}

export const config = rawConfig as unknown as StrategyConfig;
