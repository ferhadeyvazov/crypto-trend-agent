import { describe, it, expect } from "vitest";
import { config } from "../src/config/index.js";
import type { TradeRecord } from "../src/execution/types.js";
import {
  computeNetPnl,
  computeProfitFactor,
  computeWinRate,
  computeAvgRMultiple,
  computeDurationDays,
} from "../src/reporting/metrics.js";
import {
  buildEquityCurve,
  buildIsolatedEquityCurve,
  buildDailyEquitySeries,
  computeDailyReturns,
  computeSharpe,
  computeMaxDrawdownPct,
} from "../src/reporting/equityCurve.js";
import { evaluateGoLiveCriteria } from "../src/reporting/goLive.js";
import { buildPerformanceReport, topTrades } from "../src/reporting/report.js";
import type { PerformanceMetrics } from "../src/reporting/types.js";

// ===================================================================
// Reporting testləri (sənəd, bölmə 11). Trade jurnalı fixture-ləri əl
// ilə qurulub — yalnız hər metrikaya aid sahələr (netPnl, rMultiple,
// entryTime/exitTime, equityAfter) fərqləndirilir, qalanı sabit doldurulur.
// ===================================================================

function mkTrade(overrides: Partial<TradeRecord>): TradeRecord {
  return {
    id: "t", symbol: "BTCUSDT", side: "LONG", signalType: "PULLBACK",
    entryTime: 0, entryPrice: 100, stopPrice: 90, tp1Price: 110,
    size: 1, exitTime: 3_600_000, exitPrice: 105, exitReason: "X1_INITIAL_STOP",
    grossPnl: 5, fees: 0.1, slippage: 0.05, netPnl: 4.9, rMultiple: 0.49,
    equityAfter: 10004.9, regime4h: "LONG_ONLY", adx4h: 25, atr1h: 4,
    tier: "TIER1",
    ...overrides,
  };
}

const DAY = 86_400_000;
const START = Date.UTC(2026, 0, 1);

describe("computeNetPnl", () => {
  it("bütün netPnl-lərin cəmini qaytarır", () => {
    const trades = [mkTrade({ netPnl: 10 }), mkTrade({ netPnl: -5 }), mkTrade({ netPnl: 20 })];
    expect(computeNetPnl(trades)).toBeCloseTo(25, 10);
  });
});

describe("computeProfitFactor", () => {
  it("qazanclar/itkilər nisbətini hesablayır", () => {
    const trades = [mkTrade({ netPnl: 10 }), mkTrade({ netPnl: 20 }), mkTrade({ netPnl: -5 })];
    expect(computeProfitFactor(trades)).toBeCloseTo(6, 10); // 30/5
  });

  it("itki yoxdursa və qazanc varsa Infinity qaytarır", () => {
    expect(computeProfitFactor([mkTrade({ netPnl: 10 })])).toBe(Infinity);
  });

  it("trade yoxdursa 0 qaytarır", () => {
    expect(computeProfitFactor([])).toBe(0);
  });
});

describe("computeWinRate", () => {
  it("qazanclı trade-lərin nisbətini hesablayır", () => {
    const trades = [mkTrade({ netPnl: 10 }), mkTrade({ netPnl: -5 }), mkTrade({ netPnl: 20 }), mkTrade({ netPnl: -1 })];
    expect(computeWinRate(trades)).toBeCloseTo(0.5, 10);
  });
  it("trade yoxdursa 0", () => {
    expect(computeWinRate([])).toBe(0);
  });
});

describe("computeAvgRMultiple", () => {
  it("orta R-multiple-i hesablayır", () => {
    const trades = [mkTrade({ rMultiple: 1 }), mkTrade({ rMultiple: -0.5 }), mkTrade({ rMultiple: 2 })];
    expect(computeAvgRMultiple(trades)).toBeCloseTo(2.5 / 3, 10);
  });
});

describe("computeDurationDays", () => {
  it("ilk giriş ilə son çıxış arasındakı gün sayını hesablayır", () => {
    const trades = [
      mkTrade({ entryTime: START, exitTime: START + 5 * DAY }),
      mkTrade({ entryTime: START + 2 * DAY, exitTime: START + 15 * DAY }),
    ];
    expect(computeDurationDays(trades)).toBeCloseTo(15, 10);
  });
});

describe("equityCurve", () => {
  it("buildEquityCurve — ilkin equity-dən başlayıb hər trade-in equityAfter-i ilə davam edir, vaxta görə sıralanır", () => {
    const trades = [
      mkTrade({ exitTime: START + 2 * DAY, equityAfter: 10050 }),
      mkTrade({ exitTime: START + DAY, equityAfter: 10100 }),
    ];
    const curve = buildEquityCurve(trades, 10000, START);
    expect(curve.map((p) => p.equity)).toEqual([10000, 10100, 10050]);
  });

  it("computeMaxDrawdownPct — zirvədən-dibə ən böyük düşüşü faizlə tapır", () => {
    const trades = [
      mkTrade({ exitTime: START + DAY, equityAfter: 11000 }),
      mkTrade({ exitTime: START + 2 * DAY, equityAfter: 9000 }),
      mkTrade({ exitTime: START + 3 * DAY, equityAfter: 9500 }), // qismən bərpa, amma max drawdown dəyişmir
    ];
    const curve = buildEquityCurve(trades, 10000, START);
    expect(computeMaxDrawdownPct(curve)).toBeCloseTo(18.181818181818183, 8); // (11000-9000)/11000×100
  });

  it("buildDailyEquitySeries — trade olmayan günlər əvvəlki dəyərlə forward-fill olunur", () => {
    const trades = [
      mkTrade({ exitTime: START + DAY, equityAfter: 10100 }),
      mkTrade({ exitTime: START + 2 * DAY, equityAfter: 10050 }),
      mkTrade({ exitTime: START + 4 * DAY, equityAfter: 10300 }), // 3-cü gün trade yoxdur
    ];
    const curve = buildEquityCurve(trades, 10000, START);
    const daily = buildDailyEquitySeries(curve);
    expect(daily).toEqual([10000, 10100, 10050, 10050, 10300]);
  });

  it("computeSharpe — sabit gündəlik gəlirdə (std=0) 0 qaytarır", () => {
    expect(computeSharpe([0.01, 0.01, 0.01])).toBe(0);
  });

  it("computeSharpe — dəyişkən gündəlik gəlirlərdən illiləşdirilmiş nisbəti hesablayır", () => {
    const returns = computeDailyReturns([10000, 10100, 10050, 10050, 10300]);
    expect(computeSharpe(returns)).toBeCloseTo(12.542691360293047, 6);
  });

  it("buildIsolatedEquityCurve — equityAfter-i YOX, verilən trade-lərin öz netPnl-lərinin cəmini istifadə edir", () => {
    // equityAfter (bütün portfelin ortaq equity-si) qəsdən netPnl-lə uyğunsuz qoyulub —
    // bununla buildEquityCurve-dən fərqli nəticə verdiyini sübut edirik.
    const trades = [
      mkTrade({ exitTime: START + DAY, netPnl: 500, equityAfter: 99999 }),
      mkTrade({ exitTime: START + 2 * DAY, netPnl: -200, equityAfter: 11111 }),
    ];
    const curve = buildIsolatedEquityCurve(trades, 10000, START);
    expect(curve.map((p) => p.equity)).toEqual([10000, 10500, 10300]);
  });
});

describe("evaluateGoLiveCriteria", () => {
  const passingMetrics: PerformanceMetrics = {
    netPnl: 500,
    profitFactor: 1.5,
    maxDrawdownPct: 8,
    winRate: 0.4,
    avgRMultiple: 0.2,
    tradeCount: 120,
    durationDays: 65,
    sharpe: 1.2,
    criticalErrorCount30d: 0,
  };

  it("bütün həddlər ödəndikdə eligible=true qaytarır", () => {
    const result = evaluateGoLiveCriteria(passingMetrics, config);
    expect(result).toEqual({ eligible: true, failed: [], requiresExplicitUserApproval: true });
  });

  it("tək bir hədd ödənməsə belə eligible=false olur", () => {
    const result = evaluateGoLiveCriteria({ ...passingMetrics, profitFactor: 1.1 }, config);
    expect(result.eligible).toBe(false);
    expect(result.failed).toEqual(["PROFIT_FACTOR"]);
  });

  it("bir neçə hədd eyni anda ödənməyəndə hamısı siyahıya düşür", () => {
    const result = evaluateGoLiveCriteria(
      { ...passingMetrics, netPnl: -10, tradeCount: 50, criticalErrorCount30d: 2 },
      config,
    );
    expect(result.eligible).toBe(false);
    expect(result.failed).toEqual(["NET_PNL", "TRADE_COUNT", "TECHNICAL_STABILITY"]);
  });
});

describe("topTrades", () => {
  const trades = [
    mkTrade({ id: "a", netPnl: 10 }),
    mkTrade({ id: "b", netPnl: -20 }),
    mkTrade({ id: "c", netPnl: 50 }),
    mkTrade({ id: "d", netPnl: -5 }),
    mkTrade({ id: "e", netPnl: 30 }),
    mkTrade({ id: "f", netPnl: -1 }),
  ];

  it("ən yaxşı N trade-i azalan sırada qaytarır", () => {
    expect(topTrades(trades, 3, true).map((t) => t.id)).toEqual(["c", "e", "a"]);
  });

  it("ən pis N trade-i artan sırada qaytarır", () => {
    expect(topTrades(trades, 3, false).map((t) => t.id)).toEqual(["b", "d", "f"]);
  });
});

describe("buildPerformanceReport — tam inteqrasiya", () => {
  it("metrikaları, go-live nəticəsini, equity əyrisini və ən yaxşı/pis trade-ləri birləşdirir", () => {
    const trades = [
      mkTrade({ id: "a", netPnl: 100, rMultiple: 1, exitTime: START + DAY, equityAfter: 10100, entryTime: START }),
      mkTrade({ id: "b", netPnl: -50, rMultiple: -0.5, exitTime: START + 2 * DAY, equityAfter: 10050, entryTime: START + DAY }),
    ];
    const report = buildPerformanceReport(trades, config, { startTime: START, criticalErrorCount30d: 0 });

    expect(report.metrics.netPnl).toBeCloseTo(50, 10);
    expect(report.metrics.tradeCount).toBe(2);
    expect(report.goLive.eligible).toBe(false); // tradeCount(2) < minClosedTrades(100)
    expect(report.goLive.failed).toContain("TRADE_COUNT");
    expect(report.bestTrades[0]!.id).toBe("a");
    expect(report.worstTrades[0]!.id).toBe("b");
    expect(report.equityCurve[0]).toEqual({ time: START, equity: config.paperTrading.initialEquityUsd });
  });

  it("tierBreakdown — TIER2-nin böyük itkisi TIER1-in öz equity əyrisinə/drawdown-una sızmır", () => {
    // equityAfter portfelin ORTAQ (hər iki tier-in birgə) equity-sidir — TIER1 özü
    // yalnız qazanır (heç bir itki yoxdur), amma araya girən böyük TIER2 itkisi
    // equityAfter-i 10500-dən 8000-ə endirir. Köhnə (bug-lı) davranış bunu TIER1-in
    // öz drawdown-u kimi göstərərdi; düzəlişdən sonra tierBreakdown.tier1 YALNIZ
    // TIER1-in öz netPnl-lərini görməlidir.
    const trades = [
      mkTrade({ id: "t1a", tier: "TIER1", netPnl: 500, exitTime: START + DAY, equityAfter: 10500 }),
      mkTrade({ id: "t2a", tier: "TIER2", netPnl: -3000, exitTime: START + 2 * DAY, equityAfter: 7500 }),
      mkTrade({ id: "t1b", tier: "TIER1", netPnl: 500, exitTime: START + 3 * DAY, equityAfter: 8000 }),
    ];
    const report = buildPerformanceReport(trades, config, { startTime: START, criticalErrorCount30d: 0 });

    expect(report.tierBreakdown.tier1.netPnl).toBeCloseTo(1000, 10);
    expect(report.tierBreakdown.tier1.maxDrawdownPct).toBe(0); // TIER1 özü heç vaxt düşməyib
    expect(report.tierBreakdown.tier2.netPnl).toBeCloseTo(-3000, 10);
    expect(report.tierBreakdown.tier2.tradeCount).toBe(1);
    // Ümumi (qarışıq) metrikalar dəyişməz qalır — bütün portfelin real drawdown-unu göstərir
    expect(report.metrics.maxDrawdownPct).toBeGreaterThan(0);
  });
});
