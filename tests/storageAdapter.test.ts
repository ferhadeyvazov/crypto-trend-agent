import { describe, it, expect } from "vitest";
import { readTrades } from "../src/server/storage-adapter/readTrades.js";
import { readSignalEvents } from "../src/server/storage-adapter/readSignalEvents.js";
import {
  toApiPosition,
  toApiTrade,
  toApiSignal,
  toApiEquityPoint,
  toApiSystemHealth,
} from "../src/server/storage-adapter/toApi.js";
import { HealthTracker } from "../src/health/HealthTracker.js";
import type { Position, TradeRecord } from "../src/execution/types.js";
import type { LogEvent } from "../src/logging/index.js";

// ===================================================================
// storage-adapter testləri (Mərhələ 2) — FileStatePersistence
// konvensiyası ilə eyni: `readFile` inject olunur, real diskə toxunulmur.
// ===================================================================

function fakeReadFile(files: Record<string, string>) {
  return async (path: string) => (path in files ? files[path]! : null);
}

describe("readTrades", () => {
  it("fayl yoxdursa boş massiv qaytarır", async () => {
    const trades = await readTrades("trades.jsonl", { readFile: fakeReadFile({}) });
    expect(trades).toEqual([]);
  });

  it("hər sətirdə bir TradeRecord parse edir, korlanmış sətri atlayır", async () => {
    const t: Partial<TradeRecord> = { id: "1", symbol: "BTCUSDT", netPnl: 10 };
    const content = `${JSON.stringify(t)}\nbu düzgün JSON deyil\n${JSON.stringify({ ...t, id: "2" })}\n`;
    const trades = await readTrades("trades.jsonl", { readFile: fakeReadFile({ "trades.jsonl": content }) });
    expect(trades).toHaveLength(2);
    expect(trades.map((x) => x.id)).toEqual(["1", "2"]);
  });
});

describe("readSignalEvents", () => {
  it("yalnız level=SIGNAL sətirlərini qaytarır", async () => {
    const lines = [
      { ts: 1, level: "SIGNAL", message: "a", data: { symbol: "BTCUSDT", type: "PULLBACK" } },
      { ts: 2, level: "TRADE", message: "b" },
      { ts: 3, level: "SIGNAL", message: "c", data: { symbol: "ETHUSDT" } },
    ];
    const content = lines.map((l) => JSON.stringify(l)).join("\n");
    const events = await readSignalEvents("events.jsonl", { readFile: fakeReadFile({ "events.jsonl": content }) });
    expect(events).toHaveLength(2);
    expect(events.every((e) => e.level === "SIGNAL")).toBe(true);
  });
});

function mkPosition(overrides: Partial<Position> = {}): Position {
  return {
    symbol: "BTCUSDT",
    direction: "LONG",
    state: "OPEN_FULL",
    signalType: "PULLBACK",
    tier: "TIER1",
    originalSize: 10,
    remainingSize: 10,
    entryTime: 1000,
    entryPrice: 100,
    atr1hAtEntry: 4,
    regime4hAtEntry: "LONG_ONLY",
    adx4hAtEntry: 25,
    initialStop: 92.85,
    stop: 92.85,
    tp1Price: 107.25,
    tp1Filled: false,
    extremeSinceEntry: 100,
    barsSinceEntry: 0,
    realizedGrossPnl: 0,
    realizedFees: 0,
    realizedSlippageCost: 0,
    lastExitTime: 0,
    lastExitPrice: 0,
    lastExitReason: "X1_INITIAL_STOP",
    ...overrides,
  };
}

describe("toApiPosition", () => {
  it("LONG üçün currentPrice > entryPrice olduqda unrealizedPnl müsbətdir", () => {
    const api = toApiPosition(mkPosition(), 110);
    expect(api).toEqual({
      id: "BTCUSDT",
      symbol: "BTCUSDT",
      side: "long",
      tier: "TIER1",
      entryPrice: 100,
      size: 10,
      stopLoss: 92.85,
      takeProfit: 107.25,
      openedAt: 1000,
      unrealizedPnl: 100, // (110-100)×10
    });
  });

  it("TIER2 pozisiyanı da düzgün ötürür", () => {
    const api = toApiPosition(mkPosition({ tier: "TIER2" }), 110);
    expect(api.tier).toBe("TIER2");
  });

  it("SHORT üçün currentPrice < entryPrice olduqda unrealizedPnl müsbətdir", () => {
    const api = toApiPosition(mkPosition({ direction: "SHORT", entryPrice: 100 }), 90);
    expect(api.side).toBe("short");
    expect(api.unrealizedPnl).toBe(100); // (100-90)×10
  });

  it("currentPrice yoxdursa (keş boşdur) unrealizedPnl 0 qaytarılır", () => {
    const api = toApiPosition(mkPosition(), null);
    expect(api.unrealizedPnl).toBe(0);
  });
});

describe("toApiTrade", () => {
  it("TradeRecord-u API Trade-ə çevirir", () => {
    const trade: TradeRecord = {
      id: "BTCUSDT-1-1", symbol: "BTCUSDT", side: "LONG", signalType: "PULLBACK", tier: "TIER2",
      entryTime: 1000, entryPrice: 100, stopPrice: 92.85, tp1Price: 107.25, size: 10,
      exitTime: 2000, exitPrice: 95, exitReason: "X1_INITIAL_STOP",
      grossPnl: -50, fees: 1, slippage: 0.5, netPnl: -51, rMultiple: -1,
      equityAfter: 9949, regime4h: "LONG_ONLY", adx4h: 25, atr1h: 4,
    };
    const api = toApiTrade(trade);
    expect(api).toEqual({
      id: "BTCUSDT-1-1", symbol: "BTCUSDT", side: "long", tier: "TIER2", entryPrice: 100, size: 10,
      stopLoss: 92.85, takeProfit: 107.25, openedAt: 1000, exitPrice: 95, closedAt: 2000,
      realizedPnl: -51, ruleCode: "PULLBACK_X1_INITIAL_STOP", exitReason: "X1_INITIAL_STOP",
    });
  });
});

describe("toApiSignal", () => {
  it("type sahəsi olmayan (rədd/'siqnal yoxdur') hadisələri null qaytarır", () => {
    const event: LogEvent = { ts: 1, level: "SIGNAL", message: "no signal", data: { symbol: "BTCUSDT", regime: "NO_TRADE" } };
    expect(toApiSignal(event)).toBeNull();
  });

  it("həqiqi siqnalı düzgün çevirir, timeframe defolt 1H-dır", () => {
    const event: LogEvent = { ts: 5000, level: "SIGNAL", message: "sig", data: { symbol: "BTCUSDT", type: "BREAKOUT", direction: "LONG" } };
    expect(toApiSignal(event)).toEqual({ symbol: "BTCUSDT", timeframe: "1H", type: "BREAKOUT", createdAt: 5000 });
  });
});

describe("toApiEquityPoint", () => {
  it("time sahəsini timestamp-a çevirir", () => {
    expect(toApiEquityPoint({ time: 123, equity: 456 })).toEqual({ timestamp: 123, equity: 456 });
  });
});

describe("toApiSystemHealth", () => {
  it("engineState/stateLog ExecutionEngine-dən, schedulerStatus/lastFetchAt/recentErrors HealthTracker-dən gəlir", () => {
    let nowMs = 1000;
    const now = () => nowMs;
    const healthTracker = new HealthTracker({ log() {}, trade() {}, signal() {}, risk() {}, warn() {}, error() {} }, { now });
    healthTracker.signal("BTCUSDT: PULLBACK siqnalı");
    healthTracker.error("test xətası");
    healthTracker.recordCycleCompleted(1000);

    const fakeEngine = {
      isEntriesPaused: () => true,
      getEngineStateLog: () => [{ paused: true, changedAt: 900, reason: "manual (dashboard)" }],
    };

    nowMs = 1000;
    const health = toApiSystemHealth(fakeEngine, healthTracker, nowMs);
    expect(health.engineState).toBe("paused");
    expect(health.stateChangedAt).toBe(900);
    expect(health.stateLog).toEqual([{ state: "paused", changedAt: 900, reason: "manual (dashboard)" }]);
    expect(health.lastFetchAt).toBe(1000);
    expect(health.schedulerStatus).toBe("running");
    expect(health.recentErrors).toHaveLength(1);
    // recentEvents HAMISINI (SIGNAL + ERROR) saxlayır — recentErrors YALNIZ ERROR-u.
    expect(health.recentEvents).toHaveLength(2);
    expect(health.recentEvents[0]).toContain("SIGNAL");
    expect(health.recentEvents[1]).toContain("ERROR");
  });
});
