import { describe, it, expect, beforeEach, afterEach } from "vitest";
import type { AddressInfo } from "node:net";
import { createApiApp } from "../src/server/api/app.js";
import { ExecutionEngine } from "../src/execution/ExecutionEngine.js";
import { HealthTracker } from "../src/health/HealthTracker.js";
import { createServerEvents } from "../src/server/serverEvents.js";
import { config } from "../src/config/index.js";
import type { TradeRecord } from "../src/execution/types.js";
import type { RegimeSnapshot } from "../shared/types.js";

// ===================================================================
// Express API inteqrasiya testləri (Mərhələ 2). Real `express` app-i
// ephemeral portda başladıb Node-un daxili `fetch`-i ilə sınayır —
// yeni test-dependency (supertest) əlavə olunmayıb.
// ===================================================================

const CONTROL_TOKEN = "test-token";

function mkCandle(i: number, open: number, high: number, low: number, close: number) {
  return { openTime: i * 3_600_000, open, high, low, close, volume: 0, closeTime: (i + 1) * 3_600_000 - 1 };
}

async function startTestServer(files: Record<string, string> = {}, regimeSnapshots: RegimeSnapshot[] = []) {
  let nowMs = 10_000;
  const now = () => nowMs;
  const trades: TradeRecord[] = [];
  const executionEngine = new ExecutionEngine(config, { now, appendTrade: (r) => trades.push(r) });
  const healthTracker = new HealthTracker({ log() {}, trade() {}, signal() {}, risk() {}, warn() {}, error() {} }, { now });

  const { app } = createApiApp({
    executionEngine,
    config,
    healthTracker,
    now,
    readFile: async (path: string) => (path in files ? files[path]! : null),
    tradesFilePath: "trades.jsonl",
    eventsFilePath: "events.jsonl",
    getCachedClose: () => 105,
    serverEvents: createServerEvents(),
    getRegimeSnapshots: () => regimeSnapshots,
  });

  const server = app.listen(0);
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const port = (server.address() as AddressInfo).port;
  const baseUrl = `http://127.0.0.1:${port}`;

  return {
    baseUrl,
    executionEngine,
    setNow: (ms: number) => { nowMs = ms; },
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
}

describe("Dashboard REST API", () => {
  let ctx: Awaited<ReturnType<typeof startTestServer>>;

  afterEach(async () => {
    delete process.env.CONTROL_TOKEN;
    await ctx?.close();
  });

  it("GET /api/portfolio — { data, error } formasında equity qaytarır", async () => {
    ctx = await startTestServer();
    const res = await fetch(`${ctx.baseUrl}/api/portfolio`);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.error).toBeNull();
    expect(body.data.equity).toBe(config.paperTrading.initialEquityUsd);
    expect(body.data.openPositionCount).toBe(0);
    expect(body.data.dailyPnlUsd).toBe(0);
    expect(body.data.allTimePnlPct).toBe(0); // equity === initialEquity, hələ trade yoxdur
  });

  it("GET /api/positions — yalnız fill olmuş pozisiyaları, unrealizedPnl ilə qaytarır", async () => {
    ctx = await startTestServer();
    ctx.executionEngine.queueEntry({ symbol: "BTCUSDT", direction: "LONG", signalType: "PULLBACK", size: 10, atr1hAtSignal: 4, regime4h: "LONG_ONLY", adx4h: 25 });
    // hələ fill olmayıb (PENDING_ENTRY) — siyahıda görünməməlidir
    let res = await fetch(`${ctx.baseUrl}/api/positions`);
    let body = await res.json();
    expect(body.data).toEqual([]);

    ctx.executionEngine.onBarClose("BTCUSDT", mkCandle(0, 100, 102, 98, 100), { regime4h: "LONG_ONLY", atr1hCurrent: 4 });
    res = await fetch(`${ctx.baseUrl}/api/positions`);
    body = await res.json();
    expect(body.data).toHaveLength(1);
    expect(body.data[0].symbol).toBe("BTCUSDT");
    expect(body.data[0].unrealizedPnl).toBeCloseTo((105 - body.data[0].entryPrice) * 10, 6);
  });

  it("GET /api/trades — trades.jsonl-dən oxuyur, limit/symbol filtrləyir", async () => {
    const t1 = { id: "1", symbol: "BTCUSDT", side: "LONG", signalType: "PULLBACK", entryTime: 1, entryPrice: 100, stopPrice: 90, tp1Price: 110, size: 1, exitTime: 100, exitPrice: 105, exitReason: "X1_INITIAL_STOP", grossPnl: 5, fees: 0, slippage: 0, netPnl: 5, rMultiple: 1, equityAfter: 10005, regime4h: "LONG_ONLY", adx4h: 25, atr1h: 4 };
    const t2 = { ...t1, id: "2", symbol: "ETHUSDT", exitTime: 200 };
    ctx = await startTestServer({ "trades.jsonl": `${JSON.stringify(t1)}\n${JSON.stringify(t2)}\n` });

    const res = await fetch(`${ctx.baseUrl}/api/trades?symbol=BTCUSDT`);
    const body = await res.json();
    expect(body.data).toHaveLength(1);
    expect(body.data[0].id).toBe("1");
  });

  it("GET /api/signals — yalnız type sahəli (həqiqi) siqnalları qaytarır", async () => {
    const events = [
      { ts: 1, level: "SIGNAL", message: "a", data: { symbol: "BTCUSDT", type: "PULLBACK" } },
      { ts: 2, level: "SIGNAL", message: "no signal", data: { symbol: "ETHUSDT" } },
    ];
    ctx = await startTestServer({ "events.jsonl": events.map((e) => JSON.stringify(e)).join("\n") });
    const res = await fetch(`${ctx.baseUrl}/api/signals`);
    const body = await res.json();
    expect(body.data).toHaveLength(1);
    expect(body.data[0].symbol).toBe("BTCUSDT");
  });

  it("GET /api/equity-curve və /api/metrics — boş trade jurnalı ilə belə xətasız cavab verir", async () => {
    ctx = await startTestServer();
    const curveRes = await fetch(`${ctx.baseUrl}/api/equity-curve`);
    expect((await curveRes.json()).data).toHaveLength(1); // yalnız başlanğıc nöqtəsi

    const metricsRes = await fetch(`${ctx.baseUrl}/api/metrics`);
    const metricsBody = await metricsRes.json();
    expect(metricsBody.data.metrics.tradeCount).toBe(0);
    expect(metricsBody.data.goLive.eligible).toBe(false);
    expect(metricsBody.data.goLiveThresholds).toEqual({
      minDays: config.paperTrading.minDays,
      minClosedTrades: config.paperTrading.minClosedTrades,
      maxDrawdownPct: config.goLiveCriteria.maxDrawdownPct,
    });
  });

  it("GET /api/health — engineState/schedulerStatus gözlənilən defolt dəyərləri qaytarır", async () => {
    ctx = await startTestServer();
    const res = await fetch(`${ctx.baseUrl}/api/health`);
    const body = await res.json();
    expect(body.data.engineState).toBe("running");
    expect(body.data.schedulerStatus).toBe("running");
    expect(body.data.stateLog).toEqual([]);
  });

  it("GET /api/regimes — main.ts-in in-memory rejim snapshot-larını olduğu kimi qaytarır", async () => {
    const seedRegimes: RegimeSnapshot[] = [
      { symbol: "BTCUSDT", regime4h: "bull", changedAt: 5000 },
      { symbol: "ETHUSDT", regime4h: "neutral", changedAt: 8000 },
    ];
    ctx = await startTestServer({}, seedRegimes);
    const res = await fetch(`${ctx.baseUrl}/api/regimes`);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.data).toEqual(seedRegimes);
  });

  it("POST /api/engine/stop — token yoxdursa 401, doğru token ilə pauzalayır və queueEntry-ni bloklayır", async () => {
    process.env.CONTROL_TOKEN = CONTROL_TOKEN;
    ctx = await startTestServer();

    const unauthorized = await fetch(`${ctx.baseUrl}/api/engine/stop`, { method: "POST" });
    expect(unauthorized.status).toBe(401);
    expect(ctx.executionEngine.isEntriesPaused()).toBe(false);

    const stopRes = await fetch(`${ctx.baseUrl}/api/engine/stop`, {
      method: "POST",
      headers: { "X-Control-Token": CONTROL_TOKEN, "Content-Type": "application/json" },
      body: JSON.stringify({ reason: "manual (dashboard)" }),
    });
    const stopBody = await stopRes.json();
    expect(stopRes.status).toBe(200);
    expect(stopBody.data.engineState).toBe("paused");
    expect(ctx.executionEngine.isEntriesPaused()).toBe(true);

    const blockedResult = ctx.executionEngine.queueEntry({ symbol: "BTCUSDT", direction: "LONG", signalType: "PULLBACK", size: 1, atr1hAtSignal: 4, regime4h: "LONG_ONLY", adx4h: 25 });
    expect(blockedResult).toEqual({ queued: false, reason: "ENTRIES_PAUSED" });

    const startRes = await fetch(`${ctx.baseUrl}/api/engine/start`, {
      method: "POST",
      headers: { "X-Control-Token": CONTROL_TOKEN },
    });
    const startBody = await startRes.json();
    expect(startBody.data.engineState).toBe("running");
    expect(ctx.executionEngine.isEntriesPaused()).toBe(false);
  });
});
