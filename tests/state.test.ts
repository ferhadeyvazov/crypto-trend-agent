import { describe, it, expect } from "vitest";
import { FileStatePersistence } from "../src/state/filePersistence.js";
import type { StatePersistenceDeps } from "../src/state/filePersistence.js";
import type { PersistedState } from "../src/state/types.js";
import { config } from "../src/config/index.js";
import { ExecutionEngine } from "../src/execution/ExecutionEngine.js";
import type { Candle } from "../src/data/types.js";
import type { TradeRecord } from "../src/execution/types.js";

// ===================================================================
// State persistence testləri (sənəd, bölmə 13: restart bərpası).
// ===================================================================

function fakeDeps(initial: Record<string, string> = {}): StatePersistenceDeps & { files: Record<string, string> } {
  const files = { ...initial };
  return {
    files,
    readFile: async (path) => (path in files ? files[path]! : null),
    writeFile: async (path, content) => { files[path] = content; },
  };
}

describe("FileStatePersistence", () => {
  it("fayl yoxdursa null qaytarır", async () => {
    const deps = fakeDeps();
    const persistence = new FileStatePersistence("state.json", deps);
    expect(await persistence.load()).toBeNull();
  });

  it("save + load round-trip düzgün işləyir", async () => {
    const deps = fakeDeps();
    const persistence = new FileStatePersistence("state.json", deps);
    const state = {
      savedAt: 123,
      executionEngine: { positions: [], equity: 10000 },
      universe: ["BTCUSDT"],
      universeLastRebalanceAt: 100,
      universeTierMap: { BTCUSDT: "TIER1" },
    } as unknown as PersistedState;

    await persistence.save(state);
    const loaded = await persistence.load();
    expect(loaded).toEqual(state);
  });

  it("korlanmış JSON-da təsviri xəta atır", async () => {
    const deps = fakeDeps({ "state.json": "{ bu düzgün JSON deyil" });
    const persistence = new FileStatePersistence("state.json", deps);
    await expect(persistence.load()).rejects.toThrow(/korlanıb/);
  });
});

describe("ExecutionEngine.exportState / restore — round-trip", () => {
  function mkCandle(i: number, open: number, high: number, low: number, close: number): Candle {
    return { openTime: i * 3_600_000, open, high, low, close, volume: 0, closeTime: (i + 1) * 3_600_000 - 1 };
  }

  it("açıq pozisiya, equity və systemState restart-dan sonra qorunur", () => {
    const trades: TradeRecord[] = [];
    const deps = { now: () => 1, appendTrade: (r: TradeRecord) => trades.push(r) };
    const engine = new ExecutionEngine(config, deps);

    engine.queueEntry({ symbol: "BTCUSDT", direction: "LONG", signalType: "PULLBACK", size: 10, atr1hAtSignal: 4, regime4h: "LONG_ONLY", adx4h: 25, tier: "TIER1" });
    engine.onBarClose("BTCUSDT", mkCandle(0, 100, 102, 98, 100), { regime4h: "LONG_ONLY", atr1hCurrent: 4 });

    const snapshot = engine.exportState();
    const restored = ExecutionEngine.restore(config, deps, snapshot);

    expect(restored.getEquity()).toBe(engine.getEquity());
    expect(restored.getSystemState()).toBe(engine.getSystemState());
    expect(restored.getPosition("BTCUSDT")).toEqual(engine.getPosition("BTCUSDT"));
  });

  it("F4 cooldown izləməsi (son trade vaxtı) restart-dan sonra qorunur", () => {
    const trades: TradeRecord[] = [];
    const deps = { now: () => 1, appendTrade: (r: TradeRecord) => trades.push(r) };
    const engine = new ExecutionEngine(config, deps);

    engine.queueEntry({ symbol: "BTCUSDT", direction: "LONG", signalType: "PULLBACK", size: 10, atr1hAtSignal: 4, regime4h: "LONG_ONLY", adx4h: 25, tier: "TIER1" });
    engine.onBarClose("BTCUSDT", mkCandle(0, 100, 102, 98, 100), { regime4h: "LONG_ONLY", atr1hCurrent: 4 });
    engine.onBarClose("BTCUSDT", mkCandle(1, 95, 96, 90, 91), { regime4h: "LONG_ONLY", atr1hCurrent: 4 }); // X1 stop → bağlanır

    const lastTradeTime = engine.getLastTradeCloseTime("BTCUSDT");
    expect(lastTradeTime).not.toBeNull();

    const restored = ExecutionEngine.restore(config, deps, engine.exportState());
    expect(restored.getLastTradeCloseTime("BTCUSDT")).toBe(lastTradeTime);
  });

  it("manual pause-entries (Engine Control) və state log restart-dan sonra qorunur", () => {
    const deps = { now: () => 1, appendTrade: () => {} };
    const engine = new ExecutionEngine(config, deps);
    engine.pauseEntries("manual (dashboard)", 500);

    const restored = ExecutionEngine.restore(config, deps, engine.exportState());
    expect(restored.isEntriesPaused()).toBe(true);
    expect(restored.getEngineStateLog()).toEqual([{ paused: true, changedAt: 500, reason: "manual (dashboard)" }]);
  });

  it("köhnə (entriesPaused/engineStateLog sahələri olmayan) snapshot-dan defolt (pauzasız) bərpa olunur", () => {
    const deps = { now: () => 1, appendTrade: () => {} };
    const engine = new ExecutionEngine(config, deps);
    const legacySnapshot = { ...engine.exportState() } as Record<string, unknown>;
    delete legacySnapshot["entriesPaused"];
    delete legacySnapshot["engineStateLog"];

    const restored = ExecutionEngine.restore(config, deps, legacySnapshot as ReturnType<typeof engine.exportState>);
    expect(restored.isEntriesPaused()).toBe(false);
    expect(restored.getEngineStateLog()).toEqual([]);
  });

  it("köhnə (tier sahəsi olmayan, Tier2-dən əvvəlki) açıq pozisiya TIER1 kimi bərpa olunur", () => {
    const deps = { now: () => 1, appendTrade: () => {} };
    const engine = new ExecutionEngine(config, deps);
    engine.queueEntry({ symbol: "BTCUSDT", direction: "LONG", signalType: "PULLBACK", size: 10, atr1hAtSignal: 4, regime4h: "LONG_ONLY", adx4h: 25, tier: "TIER1" });

    const snapshot = engine.exportState() as unknown as { positions: Record<string, unknown>[] };
    delete snapshot.positions[0]!["tier"]; // Tier2-dən əvvəlki state.json-u simulyasiya edir

    const restored = ExecutionEngine.restore(config, deps, snapshot as unknown as ReturnType<typeof engine.exportState>);
    expect(restored.getPosition("BTCUSDT")!.tier).toBe("TIER1");
  });
});
