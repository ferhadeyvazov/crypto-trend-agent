import { describe, it, expect } from "vitest";
import { config } from "../src/config/index.js";
import type { StrategyConfig } from "../src/config/index.js";
import type { DataLayer } from "../src/data/DataLayer.js";
import type { Candle, Timeframe } from "../src/data/types.js";
import { ExecutionEngine } from "../src/execution/ExecutionEngine.js";
import type { TradeRecord } from "../src/execution/types.js";
import type { Logger, LogLevel } from "../src/logging/index.js";
import { runCycle } from "../src/orchestrator/runCycle.js";
import { msUntilNextHour, mostRecentMonday00Utc, shouldRebalanceUniverse } from "../src/orchestrator/scheduler.js";

// ===================================================================
// Orchestrator testləri (sənəd, bölmə 9). Real şəbəkə/fayl yoxdur —
// DataLayer və Logger tam saxtalaşdırılıb, ExecutionEngine isə REAL-dır
// (onun öz davranışı artıq tests/execution.test.ts-də doğrulanıb, burada
// yalnız DÜZGÜN ÇAĞIRILDIĞINI yoxlayırıq).
// ===================================================================

function mkCandle(i: number, open: number, high: number, low: number, close: number, volume = 1000): Candle {
  return { openTime: i * 3_600_000, open, high, low, close, volume, closeTime: (i + 1) * 3_600_000 - 1 };
}

/** Güclü, təmiz trend — ADX ~100, LONG_ONLY (BTC üçün, guard-ın "güclü BTC" halı). */
function buildStrongTrend4h(n = 260): Candle[] {
  const out: Candle[] = [];
  let price = 100;
  for (let i = 0; i < n; i++) {
    const close = price + 2;
    out.push(mkCandle(i, price, close + 0.5, price - 0.5, close));
    price = close;
  }
  return out;
}

/** Səs-küylü trend — ADX ≈ 25.8 (minLong=23 ilə minAltWhenBtcWeak=28 arasında). */
function buildModerateTrend4h(n = 260): Candle[] {
  const out: Candle[] = [];
  let price = 100;
  for (let i = 0; i < n; i++) {
    const noise = 20 * Math.sin(i / 2.3) * (i % 3 === 0 ? 1 : -0.6);
    const close = price + 1.5 + noise;
    const open = price;
    out.push(mkCandle(i, open, Math.max(open, close) + 0.3, Math.min(open, close) - 0.3, close));
    price = close;
  }
  return out;
}

/** Çox səs-küylü — ADX < 23, NO_TRADE (BTC-nin "zəif" halı üçün). */
function buildChoppy4h(n = 260): Candle[] {
  const out: Candle[] = [];
  let price = 100;
  for (let i = 0; i < n; i++) {
    const noise = 25 * Math.sin(i / 2.3) * (i % 3 === 0 ? 1 : -0.6);
    const close = price + 1.5 + noise;
    const open = price;
    out.push(mkCandle(i, open, Math.max(open, close) + 0.3, Math.min(open, close) - 0.3, close));
    price = close;
  }
  return out;
}

/** Açıq breakout siqnalı verən 1h fixture (Mərhələ 3-dəki eyni sübut olunmuş naxış). */
function buildBreakout1h(): Candle[] {
  const out: Candle[] = [];
  let price = 100;
  for (let i = 0; i < 73; i++) {
    const close = price + 2;
    out.push(mkCandle(i, price, close + 1, price - 1, close));
    price = close;
  }
  const last = out.at(-1)!;
  out.push(mkCandle(73, last.close, last.close + 2, last.close - 2, last.close + 1.5, 2000));
  return out;
}

/** Heç bir giriş naxışı yaratmayan sadə flat seriya (BTC-nin özündə siqnal olmasın deyə). */
function buildFlatNoSignal1h(n = 74): Candle[] {
  const out: Candle[] = [];
  for (let i = 0; i < n; i++) out.push(mkCandle(i, 100, 100.5, 99.5, 100));
  return out;
}

class FakeDataLayer implements DataLayer {
  private quarantined = new Set<string>();
  constructor(private data: Map<string, Candle[]>) {}

  async getClosedCandles(symbol: string, tf: Timeframe, limit: number): Promise<Candle[]> {
    const candles = this.data.get(`${symbol}|${tf}`);
    if (!candles) throw new Error(`FakeDataLayer: ${symbol}|${tf} üçün fixture yoxdur`);
    return candles.slice(-limit);
  }
  isQuarantined(symbol: string): boolean {
    return this.quarantined.has(symbol);
  }
  quarantine(symbol: string): void {
    this.quarantined.add(symbol);
  }
}

class FakeLogger implements Logger {
  events: { level: LogLevel; message: string; data?: Record<string, unknown> }[] = [];
  log(level: LogLevel, message: string, data?: Record<string, unknown>): void {
    this.events.push({ level, message, data });
  }
  trade(m: string, d?: Record<string, unknown>) { this.log("TRADE", m, d); }
  signal(m: string, d?: Record<string, unknown>) { this.log("SIGNAL", m, d); }
  risk(m: string, d?: Record<string, unknown>) { this.log("RISK", m, d); }
  warn(m: string, d?: Record<string, unknown>) { this.log("WARN", m, d); }
  error(m: string, d?: Record<string, unknown>) { this.log("ERROR", m, d); }
}

function mkEngine(): { engine: ExecutionEngine; trades: TradeRecord[] } {
  const trades: TradeRecord[] = [];
  const engine = new ExecutionEngine(config, { now: () => 1, appendTrade: (r) => trades.push(r) });
  return { engine, trades };
}

function baseDataMap(): Map<string, Candle[]> {
  return new Map<string, Candle[]>([
    ["BTCUSDT|4h", buildStrongTrend4h()],
    ["BTCUSDT|1h", buildFlatNoSignal1h()],
  ]);
}

describe("runCycle — siqnal → risk → giriş zənciri", () => {
  it("BTC güclüdürsə (guard aktiv deyil), moderate-ADX altcoin siqnalı təsdiqlənib növbəyə qoyulur", async () => {
    const data = baseDataMap();
    data.set("SOLUSDT|4h", buildModerateTrend4h());
    data.set("SOLUSDT|1h", buildBreakout1h());

    const { engine } = mkEngine();
    const logger = new FakeLogger();
    await runCycle(["BTCUSDT", "SOLUSDT"], {
      dataLayer: new FakeDataLayer(data), executionEngine: engine, logger, config, tierMap: {},
    });

    const pos = engine.getPosition("SOLUSDT");
    expect(pos).toBeDefined();
    expect(pos!.state).toBe("PENDING_ENTRY");
    expect(pos!.direction).toBe("LONG");
    expect(pos!.tier).toBe("TIER1");
    expect(logger.events.some((e) => e.level === "RISK" && e.message.includes("növbəyə qoyuldu"))).toBe(true);
  });

  it("TIER2 kimi işarələnmiş simvol: BTC güclü olsa belə, moderate-ADX (28-dən az) siqnal rədd edilir və giriş TIER2 kimi qeyd olunur", async () => {
    const data = baseDataMap();
    data.set("SOLUSDT|4h", buildModerateTrend4h()); // ADX ≈ 25.8 — TIER1 üçün kifayətdir, TIER2 üçün deyil
    data.set("SOLUSDT|1h", buildBreakout1h());

    const { engine } = mkEngine();
    const logger = new FakeLogger();
    await runCycle(["BTCUSDT", "SOLUSDT"], {
      dataLayer: new FakeDataLayer(data), executionEngine: engine, logger, config,
      tierMap: { SOLUSDT: "TIER2" },
    });

    expect(engine.getPosition("SOLUSDT")).toBeUndefined();
    const riskLog = logger.events.find((e) => e.level === "RISK" && e.message.includes("SOLUSDT"));
    expect(riskLog?.data?.reasons).toContain("BTC_REGIME_GUARD_ADX");
  });

  it("yeni siqnal tapılanda onSignal (dashboard signal:new üçün) çağırılır", async () => {
    const data = baseDataMap();
    data.set("SOLUSDT|4h", buildModerateTrend4h());
    data.set("SOLUSDT|1h", buildBreakout1h());

    const { engine } = mkEngine();
    const logger = new FakeLogger();
    const signals: { symbol: string; timeframe: "1H"; type: string; createdAt: number }[] = [];
    await runCycle(["BTCUSDT", "SOLUSDT"], {
      dataLayer: new FakeDataLayer(data), executionEngine: engine, logger, config, tierMap: {},
      onSignal: (s) => signals.push(s),
    });

    expect(signals).toHaveLength(1);
    expect(signals[0]).toMatchObject({ symbol: "SOLUSDT", timeframe: "1H", type: "BREAKOUT" });
  });

  it("BTC zəifdirsə (NO_TRADE), moderate-ADX (28-dən az) altcoin BTC_REGIME_GUARD_ADX ilə rədd edilir", async () => {
    const data = new Map<string, Candle[]>([
      ["BTCUSDT|4h", buildChoppy4h()],
      ["BTCUSDT|1h", buildFlatNoSignal1h()],
      ["SOLUSDT|4h", buildModerateTrend4h()],
      ["SOLUSDT|1h", buildBreakout1h()],
    ]);

    const { engine } = mkEngine();
    const logger = new FakeLogger();
    await runCycle(["BTCUSDT", "SOLUSDT"], {
      dataLayer: new FakeDataLayer(data), executionEngine: engine, logger, config, tierMap: {},
    });

    expect(engine.getPosition("SOLUSDT")).toBeUndefined();
    const riskLog = logger.events.find((e) => e.level === "RISK" && e.message.includes("SOLUSDT"));
    expect(riskLog?.data?.reasons).toContain("BTC_REGIME_GUARD_ADX");
  });

  it("onRegimeSnapshot NO_TRADE simvollar üçün DƏ çağırılır (dashboard RegimeStrip/Grid, Mərhələ 7)", async () => {
    const data = new Map<string, Candle[]>([
      ["BTCUSDT|4h", buildChoppy4h()], // NO_TRADE — mövcud loglama bunu heç göstərmir
      ["BTCUSDT|1h", buildFlatNoSignal1h()],
      ["SOLUSDT|4h", buildStrongTrend4h()], // LONG_ONLY
      ["SOLUSDT|1h", buildFlatNoSignal1h()],
    ]);

    const { engine } = mkEngine();
    const logger = new FakeLogger();
    const snapshots: { symbol: string; regime4h: "bull" | "neutral" | "bear" }[] = [];
    await runCycle(["BTCUSDT", "SOLUSDT"], {
      dataLayer: new FakeDataLayer(data), executionEngine: engine, logger, config, tierMap: {},
      onRegimeSnapshot: (s) => snapshots.push(s),
    });

    expect(snapshots).toContainEqual({ symbol: "BTCUSDT", regime4h: "neutral" });
    expect(snapshots).toContainEqual({ symbol: "SOLUSDT", regime4h: "bull" });
  });

  it("onRegimeSnapshot artıq açıq mövqəsi olan simvol üçün DƏ çağırılır", async () => {
    const data = baseDataMap();
    data.set("SOLUSDT|4h", buildStrongTrend4h());
    data.set("SOLUSDT|1h", buildFlatNoSignal1h());

    const { engine } = mkEngine();
    engine.queueEntry({ symbol: "SOLUSDT", direction: "LONG", signalType: "PULLBACK", size: 1, atr1hAtSignal: 4, regime4h: "LONG_ONLY", adx4h: 25, tier: "TIER1" });

    const logger = new FakeLogger();
    const snapshots: { symbol: string; regime4h: "bull" | "neutral" | "bear" }[] = [];
    await runCycle(["BTCUSDT", "SOLUSDT"], {
      dataLayer: new FakeDataLayer(data), executionEngine: engine, logger, config, tierMap: {},
      onRegimeSnapshot: (s) => snapshots.push(s),
    });

    expect(snapshots).toContainEqual({ symbol: "SOLUSDT", regime4h: "bull" });
  });

  it("portfel limiti dolu olanda daha yüksək ADX-li namizəd prioritet alır", async () => {
    const data = baseDataMap();
    data.set("SOLUSDT|4h", buildModerateTrend4h()); // aşağı ADX (~25.8)
    data.set("SOLUSDT|1h", buildBreakout1h());
    data.set("ADAUSDT|4h", buildStrongTrend4h()); // yüksək ADX (~100)
    data.set("ADAUSDT|1h", buildBreakout1h());

    const tightConfig: StrategyConfig = { ...config, portfolio: { ...config.portfolio, maxOpenPositions: 1 } };
    const { engine } = mkEngine();
    const logger = new FakeLogger();
    await runCycle(["BTCUSDT", "SOLUSDT", "ADAUSDT"], {
      dataLayer: new FakeDataLayer(data), executionEngine: engine, logger, config: tightConfig, tierMap: {},
    });

    expect(engine.getPosition("ADAUSDT")).toBeDefined(); // yüksək ADX qalib gəldi
    expect(engine.getPosition("SOLUSDT")).toBeUndefined();
    const solLog = logger.events.find((e) => e.level === "RISK" && e.message.includes("SOLUSDT"));
    expect(solLog?.data?.reasons).toContain("F5_MAX_OPEN_POSITIONS");
  });

  it("açıq pozisiya olan aktivdə yeni siqnal axtarılmır, mövcud pozisiya idarə olunur", async () => {
    const data = baseDataMap();
    data.set("SOLUSDT|4h", buildStrongTrend4h());
    data.set("SOLUSDT|1h", buildFlatNoSignal1h());

    const { engine } = mkEngine();
    engine.queueEntry({ symbol: "SOLUSDT", direction: "LONG", signalType: "PULLBACK", size: 1, atr1hAtSignal: 4, regime4h: "LONG_ONLY", adx4h: 25, tier: "TIER1" });
    expect(engine.getPosition("SOLUSDT")!.state).toBe("PENDING_ENTRY");

    const logger = new FakeLogger();
    await runCycle(["BTCUSDT", "SOLUSDT"], {
      dataLayer: new FakeDataLayer(data), executionEngine: engine, logger, config, tierMap: {},
    });

    // onBarClose çağırılıb — PENDING_ENTRY artıq OPEN_FULL-a fill olunub
    expect(engine.getPosition("SOLUSDT")!.state).toBe("OPEN_FULL");
    // bu simvol üçün YENİ siqnal axtarışı aparılmayıb (SIGNAL logu yoxdur)
    expect(logger.events.some((e) => e.level === "SIGNAL" && e.message.includes("SOLUSDT"))).toBe(false);
  });

  it("universe-dən düşmüş (amma açıq pozisiyası olan) simvol yenə də onBarClose alır — pozisiya 'yetim' qalmır", async () => {
    const data = baseDataMap();
    data.set("SOLUSDT|4h", buildStrongTrend4h());
    data.set("SOLUSDT|1h", buildFlatNoSignal1h());

    const { engine } = mkEngine();
    engine.queueEntry({ symbol: "SOLUSDT", direction: "LONG", signalType: "PULLBACK", size: 1, atr1hAtSignal: 4, regime4h: "LONG_ONLY", adx4h: 25, tier: "TIER1" });
    expect(engine.getPosition("SOLUSDT")!.state).toBe("PENDING_ENTRY");

    const logger = new FakeLogger();
    // Diqqət: universe SIRF ["BTCUSDT"] — SOLUSDT həftəlik rebalance-də universe-dən
    // düşüb, amma açıq (PENDING_ENTRY) pozisiyası var.
    await runCycle(["BTCUSDT"], {
      dataLayer: new FakeDataLayer(data), executionEngine: engine, logger, config, tierMap: {},
    });

    // Universe-də olmasa belə, açıq pozisiyası olduğu üçün onBarClose çağırılıb və fill olub
    expect(engine.getPosition("SOLUSDT")!.state).toBe("OPEN_FULL");
  });

  it("karantindəki aktiv keçilir, data xətası olan aktiv ERROR loglanıb ötürülür, qalanlar işləməyə davam edir", async () => {
    const data = baseDataMap();
    data.set("SOLUSDT|4h", buildModerateTrend4h());
    data.set("SOLUSDT|1h", buildBreakout1h());
    // "BROKENUSDT" üçün fixture qəsdən verilmir → getClosedCandles atacaq

    const dataLayer = new FakeDataLayer(data);
    dataLayer.quarantine("QUARANTINEDUSDT");

    const { engine } = mkEngine();
    const logger = new FakeLogger();
    await runCycle(["BTCUSDT", "QUARANTINEDUSDT", "BROKENUSDT", "SOLUSDT"], {
      dataLayer, executionEngine: engine, logger, config, tierMap: {},
    });

    expect(logger.events.some((e) => e.level === "WARN" && e.message.includes("QUARANTINEDUSDT"))).toBe(true);
    expect(logger.events.some((e) => e.level === "ERROR" && e.message.includes("BROKENUSDT"))).toBe(true);
    // SOLUSDT hələ də normal emal olunub
    expect(engine.getPosition("SOLUSDT")).toBeDefined();
  });
});

describe("scheduler — vaxt hesablamaları", () => {
  it("msUntilNextHour növbəti tam saata qədər olan vaxtı (+ bufer) hesablayır", () => {
    const now = Date.UTC(2026, 0, 1, 10, 15, 0);
    expect(msUntilNextHour(now, 5000)).toBe(45 * 60 * 1000 + 5000);
  });

  it("mostRecentMonday00Utc həmişə Bazar ertəsi 00:00 UTC-ni qaytarır", () => {
    const now = Date.UTC(2026, 2, 15, 13, 45, 0);
    const monday = mostRecentMonday00Utc(now);
    const d = new Date(monday);
    expect(d.getUTCDay()).toBe(1);
    expect(d.getUTCHours()).toBe(0);
    expect(monday).toBeLessThanOrEqual(now);
    expect(now - monday).toBeLessThan(7 * 86_400_000);
  });

  it("shouldRebalanceUniverse — ilk dəfə (null) həmişə true", () => {
    expect(shouldRebalanceUniverse(null, Date.now())).toBe(true);
  });

  it("shouldRebalanceUniverse — cari həftənin Bazar ertəsindən əvvəl olan rebalans köhnəlmiş sayılır", () => {
    const now = Date.UTC(2026, 2, 15, 13, 45, 0);
    const monday = mostRecentMonday00Utc(now);
    expect(shouldRebalanceUniverse(monday - 1000, now)).toBe(true);
    expect(shouldRebalanceUniverse(monday + 1000, now)).toBe(false);
  });
});
