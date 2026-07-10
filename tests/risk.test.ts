import { describe, it, expect } from "vitest";
import { config } from "../src/config/index.js";
import { computePositionSize } from "../src/risk/sizing.js";
import { checkPortfolioLimits, isAdxSufficientForCandidate } from "../src/risk/portfolioLimits.js";
import { checkLossLimits } from "../src/risk/lossLimits.js";
import { evaluateRisk } from "../src/risk/engine.js";
import type { OpenPositionInfo, PortfolioCandidate } from "../src/risk/types.js";

// ===================================================================
// RiskManager testləri (sənəd, bölmə 7-8). Formullar sadədir — əl ilə
// hesablanmış nümunələrlə yoxlanılır (indikatorlardakı kimi TradingView
// referansı yoxdur, çünki bunlar sənədin öz riyazi düsturlarıdır).
// ===================================================================

// config.risk.riskPerTrade=0.0075, maxNotionalPctPerPosition=20,
// config.portfolio: maxOpenPositions=6, maxTotalOpenRiskPct=3.5, maxSameDirectionAltcoins=4
// config.indicators.adx_4h: minLong=23, minAltWhenBtcWeak=28

describe("computePositionSize", () => {
  it("əl ilə hesablanan hal: cap-siz (equity=10000, entry=100, stop=90)", () => {
    // riskAmount=75, stopDistance=10, positionSize=7.5, notional=750 (< 20% cap=2000)
    const r = computePositionSize(10000, 100, 90, 10, config);
    expect(r).toEqual({ positionSize: 7.5, notional: 750, riskAmount: 75, stopDistance: 10, skipped: null });
  });

  it("notional 20% tavanını aşanda pozisiya ölçüsü kiçildilir", () => {
    // riskAmount=75, stopDistance=1.8, xam positionSize=41.667, xam notional=4166.67 > cap(2000)
    const r = computePositionSize(10000, 100, 98.2, 10, config);
    expect(r.notional).toBeCloseTo(2000, 8);
    expect(r.positionSize).toBeCloseTo(20, 8);
    expect(r.skipped).toBeNull();
  });

  it("notional minNotional-dan azdırsa SKIPPED (BELOW_MIN_NOTIONAL)", () => {
    const r = computePositionSize(100, 100, 90, 10, config); // notional=7.5 < minNotional=10
    expect(r).toEqual({
      positionSize: 0, notional: 0,
      riskAmount: 0.75, stopDistance: 10, skipped: "BELOW_MIN_NOTIONAL",
    });
  });

  it("stop məsafəsi 0-dırsa SKIPPED (INVALID_STOP_DISTANCE)", () => {
    const r = computePositionSize(10000, 100, 100, 10, config);
    expect(r.skipped).toBe("INVALID_STOP_DISTANCE");
    expect(r.positionSize).toBe(0);
  });
});

describe("checkPortfolioLimits", () => {
  const altLong: PortfolioCandidate = { symbol: "SOLUSDT", direction: "LONG", isCoreAsset: false, adx4h: 25 };

  it("bütün limitlər daxilindədirsə keçir", () => {
    const result = checkPortfolioLimits(altLong, [], config);
    expect(result).toEqual({ passed: true, failed: [] });
  });

  it("maks açıq pozisiya sayına çatanda rədd edilir", () => {
    const openPositions: OpenPositionInfo[] = Array.from({ length: 6 }, (_, i) => ({
      symbol: `A${i}USDT`, direction: "LONG", isCoreAsset: false, openRiskPct: 0,
    }));
    const result = checkPortfolioLimits(altLong, openPositions, config);
    expect(result.passed).toBe(false);
    expect(result.failed).toContain("F5_MAX_OPEN_POSITIONS");
  });

  it("ümumi açıq risk limiti aşılanda rədd edilir", () => {
    // mövcud 3% + yeni trade-in riski (0.75%) = 3.75% > maxTotalOpenRiskPct(3.5%)
    const openPositions: OpenPositionInfo[] = [
      { symbol: "BTCUSDT", direction: "LONG", isCoreAsset: true, openRiskPct: 0.03 },
    ];
    const result = checkPortfolioLimits(altLong, openPositions, config);
    expect(result.passed).toBe(false);
    expect(result.failed).toContain("F5_MAX_TOTAL_OPEN_RISK");
  });

  it("korrelyasiya qaydası: BTC/ETH xaric, eyni istiqamətdə 4 altcoin limitindən sonra rədd edilir", () => {
    const openPositions: OpenPositionInfo[] = [
      ...Array.from({ length: 4 }, (_, i): OpenPositionInfo => (
        { symbol: `A${i}USDT`, direction: "LONG", isCoreAsset: false, openRiskPct: 0 }
      )),
    ];
    const result = checkPortfolioLimits(altLong, openPositions, config);
    expect(result.failed).toContain("F5_CORRELATION_LIMIT");
  });

  it("korrelyasiya qaydası BTC/ETH-ə (core asset) tətbiq olunmur", () => {
    const btcCandidate: PortfolioCandidate = { symbol: "BTCUSDT", direction: "LONG", isCoreAsset: true, adx4h: 25 };
    const openPositions: OpenPositionInfo[] = Array.from({ length: 4 }, (_, i): OpenPositionInfo => (
      { symbol: `A${i}USDT`, direction: "LONG", isCoreAsset: false, openRiskPct: 0 }
    ));
    const result = checkPortfolioLimits(btcCandidate, openPositions, config);
    expect(result.failed).not.toContain("F5_CORRELATION_LIMIT");
  });

  it("əks istiqamətdəki altcoin pozisiyaları korrelyasiya sayına daxil edilmir", () => {
    const openPositions: OpenPositionInfo[] = Array.from({ length: 4 }, (_, i): OpenPositionInfo => (
      { symbol: `A${i}USDT`, direction: "SHORT", isCoreAsset: false, openRiskPct: 0 }
    ));
    const result = checkPortfolioLimits(altLong, openPositions, config); // altLong = LONG
    expect(result.failed).not.toContain("F5_CORRELATION_LIMIT");
  });
});

describe("isAdxSufficientForCandidate — BTC regime guard", () => {
  const alt = (adx4h: number, direction: "LONG" | "SHORT" = "LONG"): PortfolioCandidate => (
    { symbol: "SOLUSDT", direction, isCoreAsset: false, adx4h }
  );

  it("BTC zəifdirsə (NO_TRADE), altcoin LONG üçün ADX 28-dən az olanda rədd edilir", () => {
    expect(isAdxSufficientForCandidate(alt(25), "NO_TRADE", config)).toBe(false);
  });

  it("BTC zəifdirsə, altcoin LONG üçün ADX 28+ olanda keçir", () => {
    expect(isAdxSufficientForCandidate(alt(30), "NO_TRADE", config)).toBe(true);
  });

  it("BTC güclüdürsə (LONG_ONLY), altcoin LONG üçün adi hədd (23) kifayətdir", () => {
    expect(isAdxSufficientForCandidate(alt(25), "LONG_ONLY", config)).toBe(true);
  });

  it("guard yalnız LONG-a tətbiq olunur, SHORT-a yox", () => {
    expect(isAdxSufficientForCandidate(alt(25, "SHORT"), "NO_TRADE", config)).toBe(true);
  });

  it("guard core aktivlərə (BTC/ETH-in özü) tətbiq olunmur", () => {
    const btc: PortfolioCandidate = { symbol: "BTCUSDT", direction: "LONG", isCoreAsset: true, adx4h: 25 };
    expect(isAdxSufficientForCandidate(btc, "NO_TRADE", config)).toBe(true);
  });
});

describe("checkLossLimits", () => {
  it("heç bir limit pozulmayıbsa null qaytarır", () => {
    expect(checkLossLimits(-1, -2, 1, config)).toBeNull();
  });

  it("gündəlik limit (-3%) pozulanda DAILY_LOSS_LIMIT", () => {
    expect(checkLossLimits(-3.2, -1, 1, config)).toBe("DAILY_LOSS_LIMIT");
  });

  it("ardıcıl 4 itkidən sonra CONSECUTIVE_LOSS_LIMIT", () => {
    expect(checkLossLimits(-1, -1, 4, config)).toBe("CONSECUTIVE_LOSS_LIMIT");
  });

  it("həftəlik limit (-6%) pozulanda WEEKLY_HALT", () => {
    expect(checkLossLimits(-1, -6.5, 1, config)).toBe("WEEKLY_HALT");
  });

  it("bir neçə limit eyni anda pozulanda WEEKLY_HALT prioritetlidir", () => {
    expect(checkLossLimits(-3.5, -6.5, 5, config)).toBe("WEEKLY_HALT");
  });
});

describe("evaluateRisk — tam inteqrasiya", () => {
  const candidate: PortfolioCandidate = { symbol: "SOLUSDT", direction: "LONG", isCoreAsset: false, adx4h: 25 };
  const entry = { entryPrice: 100, stopPrice: 90 };
  const baseContext = {
    equity: 10000,
    openPositions: [] as OpenPositionInfo[],
    minNotional: 10,
    btcRegime: "LONG_ONLY" as const,
    dailyPnlPct: -1,
    weeklyPnlPct: -1,
    consecutiveLosses: 0,
  };

  it("bütün şərtlər ödəndikdə təsdiqlənir və ölçüləndirmə qaytarır", () => {
    const result = evaluateRisk(candidate, entry, baseContext, config);
    expect(result.approved).toBe(true);
    expect(result.sizing).toEqual({ positionSize: 7.5, notional: 750, riskAmount: 75, stopDistance: 10, skipped: null });
    expect(result.rejected).toEqual([]);
  });

  it("zərər limiti pozulubsa ölçüləndirməyə keçmədən rədd edir", () => {
    const result = evaluateRisk(candidate, entry, { ...baseContext, weeklyPnlPct: -7 }, config);
    expect(result.approved).toBe(false);
    expect(result.sizing).toBeNull();
    expect(result.rejected).toEqual(["WEEKLY_HALT"]);
  });

  it("BTC regime guard pozulubsa rədd edir", () => {
    const result = evaluateRisk(candidate, entry, { ...baseContext, btcRegime: "NO_TRADE" }, config);
    expect(result.approved).toBe(false);
    expect(result.rejected).toEqual(["BTC_REGIME_GUARD_ADX"]);
  });

  it("portfel limiti pozulubsa rədd edir", () => {
    const openPositions: OpenPositionInfo[] = Array.from({ length: 6 }, (_, i): OpenPositionInfo => (
      { symbol: `A${i}USDT`, direction: "LONG", isCoreAsset: false, openRiskPct: 0 }
    ));
    const result = evaluateRisk(candidate, entry, { ...baseContext, openPositions }, config);
    expect(result.approved).toBe(false);
    expect(result.rejected).toContain("F5_MAX_OPEN_POSITIONS");
  });

  it("ölçüləndirmə minNotional-dan aşağı düşürsə rədd edir", () => {
    const result = evaluateRisk(candidate, entry, { ...baseContext, equity: 100 }, config);
    expect(result.approved).toBe(false);
    expect(result.rejected).toEqual(["BELOW_MIN_NOTIONAL"]);
  });
});
