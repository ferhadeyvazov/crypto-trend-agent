import { describe, it, expect } from "vitest";
import { config } from "../src/config/index.js";
import { ExecutionEngine } from "../src/execution/ExecutionEngine.js";
import { computeCommission, computeSlippagePct, applySlippage } from "../src/execution/costModel.js";
import { evaluateSystemState, INITIAL_SYSTEM_STATE } from "../src/execution/systemState.js";
import type { Candle } from "../src/data/types.js";
import type { TradeRecord } from "../src/execution/types.js";

// ===================================================================
// ExecutionEngine testləri (sənəd, bölmə 6, 9, 10). Fixture-lər qəsdən
// SABİT diapazonlu (high-low=4, hər zaman) şamlardır — ATR14 dərhal 4-ə
// bərabərləşir, bu da stop/TP1 səviyyələrini əl ilə dəqiq hesablamağa
// imkan verir (config: stopAtrMult=1.8, tp1AtrMult=1.8 → məsafə=7.2).
// Bütün fixture-lərdə volume=0 istifadə olunur ki, slippage həmişə DƏQİQ
// baza dəyərdə (0.05%) qalsın — hesablamalar mürəkkəbləşməsin.
// ===================================================================

function mkCandle(i: number, open: number, high: number, low: number, close: number, volume = 0): Candle {
  return { openTime: i * 3_600_000, open, high, low, close, volume, closeTime: (i + 1) * 3_600_000 - 1 };
}
function mkFlat(i: number): Candle {
  return mkCandle(i, 100, 102, 98, 100);
}

function makeEngine() {
  const trades: TradeRecord[] = [];
  const engine = new ExecutionEngine(config, { now: () => 1, appendTrade: (r) => trades.push(r) });
  return { engine, trades };
}

// ======================= costModel =======================

describe("costModel", () => {
  it("computeCommission — notional × feePctPerSide", () => {
    expect(computeCommission(1000, config)).toBeCloseTo(1, 10); // 1000 × 0.10% = 1
  });

  it("computeSlippagePct — həcm datası yoxdursa yalnız baza dəyər", () => {
    expect(computeSlippagePct(500, 0, config)).toBeCloseTo(0.0005, 10);
  });

  it("computeSlippagePct — likvidlik təsiri əlavə olunur", () => {
    // 0.05% + 0.02%×(500/(0.01×100000)) = 0.0005 + 0.0002×0.5 = 0.0006
    expect(computeSlippagePct(500, 100_000, config)).toBeCloseTo(0.0006, 10);
  });

  it("applySlippage — hər istiqamət/əməliyyat üçün əleyhinə tətbiq olunur", () => {
    expect(applySlippage(100, "LONG", "ENTRY", 0.0005)).toBeCloseTo(100.05, 10); // alış → bahalaşır
    expect(applySlippage(100, "LONG", "EXIT", 0.0005)).toBeCloseTo(99.95, 10); // satış → ucuzlaşır
    expect(applySlippage(100, "SHORT", "ENTRY", 0.0005)).toBeCloseTo(99.95, 10);
    expect(applySlippage(100, "SHORT", "EXIT", 0.0005)).toBeCloseTo(100.05, 10);
  });
});

// ======================= ExecutionEngine — pozisiya dövrəsi =======================

describe("ExecutionEngine — giriş fill-i", () => {
  it("entry növbəti barın open-i + slippage ilə fill olunur, stop/TP1 §6 düsturu ilə hesablanır", () => {
    const { engine } = makeEngine();
    engine.queueEntry({ symbol: "TEST", direction: "LONG", signalType: "PULLBACK", size: 10, atr1hAtSignal: 4, regime4h: "LONG_ONLY", adx4h: 25, tier: "TIER1" });
    engine.onBarClose("TEST", mkFlat(0), { regime4h: "LONG_ONLY", atr1hCurrent: 4 });

    const pos = engine.getPosition("TEST")!;
    expect(pos.state).toBe("OPEN_FULL");
    expect(pos.entryPrice).toBeCloseTo(100.05, 10); // 100 × 1.0005
    expect(pos.initialStop).toBeCloseTo(92.85, 10); // 100.05 − 1.8×4
    expect(pos.tp1Price).toBeCloseTo(107.25, 10); // 100.05 + 1.8×4
  });

  it("systemState RUNNING deyilsə yeni giriş rədd edilir", () => {
    const { engine } = makeEngine();
    engine.queueEntry({ symbol: "A", direction: "LONG", signalType: "PULLBACK", size: 10, atr1hAtSignal: 4, regime4h: "LONG_ONLY", adx4h: 25, tier: "TIER1" });
    // 6 ardıcıl itki simulyasiyası ilə PAUSED_STREAK-ə keçirək — sadə yol: birbaşa əvvəlki pozisiyanı X1 ilə bağla
    engine.onBarClose("A", mkFlat(0), { regime4h: "LONG_ONLY", atr1hCurrent: 4 });
    for (let i = 0; i < config.risk.maxConsecutiveLosses; i++) {
      engine.queueEntry({ symbol: `L${i}`, direction: "LONG", signalType: "PULLBACK", size: 1, atr1hAtSignal: 4, regime4h: "LONG_ONLY", adx4h: 25, tier: "TIER1" });
      engine.onBarClose(`L${i}`, mkFlat(0), { regime4h: "LONG_ONLY", atr1hCurrent: 4 });
      engine.onBarClose(`L${i}`, mkCandle(1, 90, 91, 85, 88), { regime4h: "LONG_ONLY", atr1hCurrent: 4 }); // X1 stop → itki
    }
    const result = engine.queueEntry({ symbol: "NEW", direction: "LONG", signalType: "PULLBACK", size: 1, atr1hAtSignal: 4, regime4h: "LONG_ONLY", adx4h: 25, tier: "TIER1" });
    expect(result).toEqual({ queued: false, reason: "SYSTEM_NOT_RUNNING" });
    expect(engine.getSystemState()).toBe("PAUSED_STREAK");
  });

  it("eyni simvolda pozisiya artıq varsa rədd edilir (F3 təhlükəsizlik toru)", () => {
    const { engine } = makeEngine();
    engine.queueEntry({ symbol: "TEST", direction: "LONG", signalType: "PULLBACK", size: 10, atr1hAtSignal: 4, regime4h: "LONG_ONLY", adx4h: 25, tier: "TIER1" });
    const result = engine.queueEntry({ symbol: "TEST", direction: "LONG", signalType: "PULLBACK", size: 5, atr1hAtSignal: 4, regime4h: "LONG_ONLY", adx4h: 25, tier: "TIER1" });
    expect(result).toEqual({ queued: false, reason: "POSITION_ALREADY_OPEN" });
  });
});

describe("ExecutionEngine — manual pause-entries (Engine Control, dashboard/Telegram start/stop)", () => {
  it("pauseEntries yeni girişi bloklayır, resumeEntries yenidən aktivləşdirir", () => {
    const { engine } = makeEngine();
    expect(engine.isEntriesPaused()).toBe(false);

    engine.pauseEntries("manual (dashboard)", 1000);
    expect(engine.isEntriesPaused()).toBe(true);

    const blocked = engine.queueEntry({ symbol: "TEST", direction: "LONG", signalType: "PULLBACK", size: 10, atr1hAtSignal: 4, regime4h: "LONG_ONLY", adx4h: 25, tier: "TIER1" });
    expect(blocked).toEqual({ queued: false, reason: "ENTRIES_PAUSED" });

    engine.resumeEntries("manual (dashboard)", 2000);
    expect(engine.isEntriesPaused()).toBe(false);
    const allowed = engine.queueEntry({ symbol: "TEST", direction: "LONG", signalType: "PULLBACK", size: 10, atr1hAtSignal: 4, regime4h: "LONG_ONLY", adx4h: 25, tier: "TIER1" });
    expect(allowed).toEqual({ queued: true });
  });

  it("hər start/stop EngineStateLog-a səbəb və vaxtla qeyd olunur", () => {
    const { engine } = makeEngine();
    engine.pauseEntries("manual (telegram)", 1000);
    engine.resumeEntries("manual (dashboard)", 2000);

    expect(engine.getEngineStateLog()).toEqual([
      { paused: true, changedAt: 1000, reason: "manual (telegram)" },
      { paused: false, changedAt: 2000, reason: "manual (dashboard)" },
    ]);
  });

  it("pauza zamanı açıq pozisiyanın idarəsi (stop/TP) davam edir — yalnız YENİ giriş bloklanır", () => {
    const { engine, trades } = makeEngine();
    engine.queueEntry({ symbol: "TEST", direction: "LONG", signalType: "PULLBACK", size: 10, atr1hAtSignal: 4, regime4h: "LONG_ONLY", adx4h: 25, tier: "TIER1" });
    engine.onBarClose("TEST", mkFlat(0), { regime4h: "LONG_ONLY", atr1hCurrent: 4 });

    engine.pauseEntries("manual (dashboard)", 1000);
    engine.onBarClose("TEST", mkCandle(1, 95, 96, 90, 91), { regime4h: "LONG_ONLY", atr1hCurrent: 4 }); // X1 stop

    expect(engine.getPosition("TEST")).toBeUndefined();
    expect(trades).toHaveLength(1);
    expect(trades[0]!.exitReason).toBe("X1_INITIAL_STOP");
  });
});

describe("ExecutionEngine — X1 ilkin stop", () => {
  it("stop toxunulanda (gap-siz) tam bağlanır, jurnal sətri dəqiq nəticə verir", () => {
    const { engine, trades } = makeEngine();
    engine.queueEntry({ symbol: "TEST", direction: "LONG", signalType: "PULLBACK", size: 10, atr1hAtSignal: 4, regime4h: "LONG_ONLY", adx4h: 25, tier: "TIER1" });
    engine.onBarClose("TEST", mkFlat(0), { regime4h: "LONG_ONLY", atr1hCurrent: 4 });
    engine.onBarClose("TEST", mkCandle(1, 95, 96, 90, 91), { regime4h: "LONG_ONLY", atr1hCurrent: 4 });

    expect(engine.getPosition("TEST")).toBeUndefined();
    expect(trades).toHaveLength(1);
    const t = trades[0]!;
    expect(t.exitReason).toBe("X1_INITIAL_STOP");
    expect(t.exitPrice).toBeCloseTo(92.803575, 6); // 92.85 × (1 − 0.0005)
    expect(t.netPnl).toBeCloseTo(-74.39278575, 6);
    expect(t.rMultiple).toBeCloseTo(-1.0332331354, 6);
    expect(engine.getEquity()).toBeCloseTo(9925.60721425, 6);
  });

  it("gap-da (open stop-dan aşağıdır) slippagesiz open qiymətindən fill olunur", () => {
    const { engine, trades } = makeEngine();
    engine.queueEntry({ symbol: "TEST", direction: "LONG", signalType: "PULLBACK", size: 10, atr1hAtSignal: 4, regime4h: "LONG_ONLY", adx4h: 25, tier: "TIER1" });
    engine.onBarClose("TEST", mkFlat(0), { regime4h: "LONG_ONLY", atr1hCurrent: 4 });
    engine.onBarClose("TEST", mkCandle(1, 90, 91, 85, 88), { regime4h: "LONG_ONLY", atr1hCurrent: 4 }); // gap: open(90) < stop(92.85)

    const t = trades[0]!;
    expect(t.exitPrice).toBe(90); // slippagesiz, dəqiq open qiyməti
    expect(t.netPnl).toBeCloseTo(-102.4005, 4);
  });
});

describe("ExecutionEngine — eyni barda stop VƏ TP1 (STOP_FIRST, §10.3)", () => {
  it("hər ikisi toxunulanda STOP qalib gəlir (mühafizəkar fərziyyə)", () => {
    const { engine, trades } = makeEngine();
    engine.queueEntry({ symbol: "TEST", direction: "LONG", signalType: "PULLBACK", size: 10, atr1hAtSignal: 4, regime4h: "LONG_ONLY", adx4h: 25, tier: "TIER1" });
    engine.onBarClose("TEST", mkFlat(0), { regime4h: "LONG_ONLY", atr1hCurrent: 4 });
    // low(90) <= stop(92.85) VƏ high(110) >= tp1(107.25) — ikisi də toxunub
    engine.onBarClose("TEST", mkCandle(1, 100, 110, 90, 100), { regime4h: "LONG_ONLY", atr1hCurrent: 4 });

    expect(trades[0]!.exitReason).toBe("X1_INITIAL_STOP");
  });
});

describe("ExecutionEngine — X2 (TP1) → X3 (trailing stop)", () => {
  it("TP1-də 50% bağlanır, breakeven-ə keçir, sonra trailing stop qalanı bağlayır", () => {
    const { engine, trades } = makeEngine();
    engine.queueEntry({ symbol: "TEST", direction: "LONG", signalType: "BREAKOUT", size: 10, atr1hAtSignal: 4, regime4h: "LONG_ONLY", adx4h: 25, tier: "TIER1" });
    engine.onBarClose("TEST", mkFlat(0), { regime4h: "LONG_ONLY", atr1hCurrent: 4 }); // entry=100.05

    // TP1 toxunulur (high >= 107.25), stop toxunulmur
    engine.onBarClose("TEST", mkCandle(1, 101, 108, 100, 106), { regime4h: "LONG_ONLY", atr1hCurrent: 4 });
    let pos = engine.getPosition("TEST")!;
    expect(pos.state).toBe("OPEN_RUNNER");
    expect(pos.stop).toBeCloseTo(100.05, 10); // breakeven = entry
    expect(pos.remainingSize).toBeCloseTo(5, 10); // 50% bağlanıb
    expect(pos.realizedGrossPnl).toBeCloseTo(36, 6); // (107.25−100.05)×5

    // böyük yüksəliş barı: chandelier trail YENİLƏNİR, amma bu barın ÖZ low-u ilə yoxlanmır
    engine.onBarClose("TEST", mkCandle(2, 106, 120, 105, 118), { regime4h: "LONG_ONLY", atr1hCurrent: 4 });
    pos = engine.getPosition("TEST")!;
    expect(pos.stop).toBeCloseTo(108, 10); // max(100.05, 120−3×4)
    expect(pos.state).toBe("OPEN_RUNNER"); // hələ bağlanmayıb (look-ahead qərəzindən qorunma)

    // növbəti bar: qiymət trailing stop-u (108) qırır
    engine.onBarClose("TEST", mkCandle(3, 118, 119, 100, 105), { regime4h: "LONG_ONLY", atr1hCurrent: 4 });
    expect(engine.getPosition("TEST")).toBeUndefined();
    const t = trades[0]!;
    expect(t.exitReason).toBe("X3_TRAILING_STOP");
    expect(t.grossPnl).toBeCloseTo(75.48, 4);
    expect(t.netPnl).toBeCloseTo(73.40352, 4);
    expect(t.rMultiple).toBeCloseTo(1.0194933333, 6); // ilkin risk (72) əsasında, breakeven-dən sonra da DƏYİŞMİR
    expect(engine.getEquity()).toBeCloseTo(10073.40352, 4);
  });
});

describe("ExecutionEngine — X4 rejim dönüşü", () => {
  it("əks rejimə keçəndə qalan pozisiya bazar qiymətiylə tam bağlanır", () => {
    const { engine, trades } = makeEngine();
    engine.queueEntry({ symbol: "TEST", direction: "LONG", signalType: "PULLBACK", size: 10, atr1hAtSignal: 4, regime4h: "LONG_ONLY", adx4h: 25, tier: "TIER1" });
    engine.onBarClose("TEST", mkFlat(0), { regime4h: "LONG_ONLY", atr1hCurrent: 4 });
    engine.onBarClose("TEST", mkCandle(1, 100, 102, 99, 101), { regime4h: "SHORT_ONLY", atr1hCurrent: 4 }); // rejim döndü, stop/TP toxunulmayıb

    expect(engine.getPosition("TEST")).toBeUndefined();
    expect(trades[0]!.exitReason).toBe("X4_REGIME_FLIP");
    expect(trades[0]!.exitPrice).toBeCloseTo(100.9495, 6); // close(101) × (1−0.0005)
  });

  it("NO_TRADE rejimində pozisiya bağlanmır (R4.3 qeydi — dərhal bağlanma yoxdur)", () => {
    const { engine } = makeEngine();
    engine.queueEntry({ symbol: "TEST", direction: "LONG", signalType: "PULLBACK", size: 10, atr1hAtSignal: 4, regime4h: "LONG_ONLY", adx4h: 25, tier: "TIER1" });
    engine.onBarClose("TEST", mkFlat(0), { regime4h: "LONG_ONLY", atr1hCurrent: 4 });
    engine.onBarClose("TEST", mkCandle(1, 100, 102, 99, 101), { regime4h: "NO_TRADE", atr1hCurrent: 4 });

    expect(engine.getPosition("TEST")).toBeDefined();
    expect(engine.getPosition("TEST")!.state).toBe("OPEN_FULL");
  });
});

describe("ExecutionEngine — X5 vaxt dayanması", () => {
  it("TP1-ə çatmadan 72 bar keçəndə tam bağlanır", () => {
    const { engine, trades } = makeEngine();
    engine.queueEntry({ symbol: "TEST", direction: "LONG", signalType: "PULLBACK", size: 10, atr1hAtSignal: 4, regime4h: "LONG_ONLY", adx4h: 25, tier: "TIER1" });
    engine.onBarClose("TEST", mkFlat(0), { regime4h: "LONG_ONLY", atr1hCurrent: 4 });
    for (let i = 1; i <= 72; i++) {
      engine.onBarClose("TEST", mkFlat(i), { regime4h: "LONG_ONLY", atr1hCurrent: 4 });
    }
    expect(engine.getPosition("TEST")).toBeUndefined();
    expect(trades[0]!.exitReason).toBe("X5_TIME_STOP");
  });

  it("71 bar keçəndə hələ bağlanmır (sərhəd şərti)", () => {
    // Qeyd: giriş barının özü də "keçən bar" sayılır (fill-dən sonra qalan
    // high/low elə HƏMİN barda yoxlanılır) — ona görə entry (1) + 70 əlavə
    // bar = 71 ümumi, X5 hələ tətiklənmir (həddi 72-dir).
    const { engine } = makeEngine();
    engine.queueEntry({ symbol: "TEST", direction: "LONG", signalType: "PULLBACK", size: 10, atr1hAtSignal: 4, regime4h: "LONG_ONLY", adx4h: 25, tier: "TIER1" });
    engine.onBarClose("TEST", mkFlat(0), { regime4h: "LONG_ONLY", atr1hCurrent: 4 });
    for (let i = 1; i <= 70; i++) {
      engine.onBarClose("TEST", mkFlat(i), { regime4h: "LONG_ONLY", atr1hCurrent: 4 });
    }
    expect(engine.getPosition("TEST")).toBeDefined();
    expect(engine.getPosition("TEST")!.barsSinceEntry).toBe(71);
  });
});

// ======================= systemState =======================

describe("evaluateSystemState", () => {
  const day1 = Date.UTC(2026, 0, 15, 10, 0, 0);

  it("gündəlik limit pozulanda PAUSED_DAILY, bərpa növbəti UTC gecəyarısıdır", () => {
    const s = evaluateSystemState(INITIAL_SYSTEM_STATE, "DAILY_LOSS_LIMIT", day1, config);
    expect(s.state).toBe("PAUSED_DAILY");
    expect(new Date(s.resumesAt!).toISOString()).toBe("2026-01-16T00:00:00.000Z");
  });

  it("pauza vaxtı bitməyibsə RUNNING-ə qayıtmır", () => {
    const s1 = evaluateSystemState(INITIAL_SYSTEM_STATE, "DAILY_LOSS_LIMIT", day1, config);
    const s2 = evaluateSystemState(s1, null, day1 + 3_600_000, config);
    expect(s2.state).toBe("PAUSED_DAILY");
  });

  it("pauza vaxtı bitəndə (yeni pozuntu yoxdursa) RUNNING-ə qayıdır", () => {
    const s1 = evaluateSystemState(INITIAL_SYSTEM_STATE, "DAILY_LOSS_LIMIT", day1, config);
    const afterMidnight = Date.UTC(2026, 0, 16, 0, 0, 1);
    const s2 = evaluateSystemState(s1, null, afterMidnight, config);
    expect(s2).toEqual(INITIAL_SYSTEM_STATE);
  });

  it("ardıcıl itki limiti PAUSED_STREAK yaradır, bərpa +streakPauseHours saatdır", () => {
    const s = evaluateSystemState(INITIAL_SYSTEM_STATE, "CONSECUTIVE_LOSS_LIMIT", day1, config);
    expect(s.state).toBe("PAUSED_STREAK");
    expect(s.resumesAt).toBe(day1 + config.risk.streakPauseHours * 3_600_000);
  });

  it("həftəlik limit HALTED yaradır və HEÇ VAXT avtomatik bərpa olunmur", () => {
    const s1 = evaluateSystemState(INITIAL_SYSTEM_STATE, "WEEKLY_HALT", day1, config);
    const s2 = evaluateSystemState(s1, null, day1 + 30 * 24 * 3_600_000, config);
    expect(s1.state).toBe("HALTED");
    expect(s2.state).toBe("HALTED");
    expect(s2.resumesAt).toBeNull();
  });
});
