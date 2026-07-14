import { describe, it, expect, afterEach } from "vitest";
import type { AddressInfo } from "node:net";
import { io as ioClient, type Socket } from "socket.io-client";
import { createApiApp } from "../src/server/api/app.js";
import { createSocketServer } from "../src/server/ws/index.js";
import { createServerEvents, emitServerEvent } from "../src/server/serverEvents.js";
import { ExecutionEngine } from "../src/execution/ExecutionEngine.js";
import { HealthTracker } from "../src/health/HealthTracker.js";
import { config } from "../src/config/index.js";

// ===================================================================
// socket.io inteqrasiya testləri (Mərhələ 3) — real server + real
// `socket.io-client` (yalnız test dependency-si, dashboard-un öz
// client-i Mərhələ 4-də ayrıca əlavə olunacaq).
// ===================================================================

const CONTROL_TOKEN = "ws-test-token";

async function startTestServer() {
  const now = () => 5000;
  const executionEngine = new ExecutionEngine(config, { now, appendTrade: () => {} });
  const healthTracker = new HealthTracker({ log() {}, trade() {}, signal() {}, risk() {}, warn() {}, error() {} }, { now });
  const serverEvents = createServerEvents();

  const { app, dataService } = createApiApp({
    executionEngine,
    config,
    healthTracker,
    now,
    readFile: async () => null,
    tradesFilePath: "trades.jsonl",
    eventsFilePath: "events.jsonl",
    getCachedClose: () => null,
    serverEvents,
  });

  const httpServer = app.listen(0);
  await new Promise<void>((resolve) => httpServer.once("listening", resolve));
  const io = createSocketServer(httpServer, dataService, serverEvents);
  const port = (httpServer.address() as AddressInfo).port;
  const baseUrl = `http://127.0.0.1:${port}`;

  return { io, baseUrl, serverEvents, executionEngine, httpServer };
}

describe("socket.io qatı", () => {
  let client: Socket | undefined;
  let ctx: Awaited<ReturnType<typeof startTestServer>> | undefined;

  afterEach(async () => {
    client?.close();
    ctx?.io.close();
    delete process.env.CONTROL_TOKEN;
    await new Promise<void>((resolve) => ctx?.httpServer.close(() => resolve()));
  });

  it("qoşulanda portfolio:update/position:update/health:update snapshot-ları alır", async () => {
    ctx = await startTestServer();
    client = ioClient(ctx.baseUrl, { transports: ["websocket"] });

    const received = await new Promise<Set<string>>((resolve) => {
      const seen = new Set<string>();
      for (const event of ["portfolio:update", "position:update", "health:update"]) {
        client!.on(event, () => {
          seen.add(event);
          if (seen.size === 3) resolve(seen);
        });
      }
    });

    expect(received).toEqual(new Set(["portfolio:update", "position:update", "health:update"]));
  });

  it("serverEvents.emit('trade:closed', ...) qoşulu client-ə çatdırılır", async () => {
    ctx = await startTestServer();
    client = ioClient(ctx.baseUrl, { transports: ["websocket"] });
    await new Promise<void>((resolve) => client!.on("connect", resolve));

    const tradePromise = new Promise((resolve) => client!.on("trade:closed", resolve));
    const fakeTrade = { id: "1", symbol: "BTCUSDT", side: "long" as const, entryPrice: 100, size: 1, stopLoss: 90, takeProfit: 110, openedAt: 1, exitPrice: 105, closedAt: 2, realizedPnl: 5, ruleCode: "X", exitReason: "X1_INITIAL_STOP" };
    emitServerEvent(ctx.serverEvents, "trade:closed", fakeTrade);

    expect(await tradePromise).toEqual(fakeTrade);
  });

  it("POST /api/engine/stop qoşulu client-ə engine:state (paused) göndərir", async () => {
    process.env.CONTROL_TOKEN = CONTROL_TOKEN;
    ctx = await startTestServer();
    client = ioClient(ctx.baseUrl, { transports: ["websocket"] });
    await new Promise<void>((resolve) => client!.on("connect", resolve));

    const enginePromise = new Promise((resolve) => client!.on("engine:state", resolve));
    await fetch(`${ctx.baseUrl}/api/engine/stop`, {
      method: "POST",
      headers: { "X-Control-Token": CONTROL_TOKEN },
    });

    expect(await enginePromise).toEqual({ engineState: "paused", stateChangedAt: 5000 });
  });
});
