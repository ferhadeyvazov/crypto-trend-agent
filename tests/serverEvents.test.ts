import { describe, it, expect } from "vitest";
import { DataService } from "../src/server/api/dataService.js";
import { createServerEvents, onServerEvent } from "../src/server/serverEvents.js";
import { ExecutionEngine } from "../src/execution/ExecutionEngine.js";
import { HealthTracker } from "../src/health/HealthTracker.js";
import { config } from "../src/config/index.js";

// ===================================================================
// `DataService` ilə `serverEvents` bus-u arasındakı əlaqə (Mərhələ 3) —
// socket.io olmadan, real EventEmitter ilə. Socket.io-ya qədər olan
// tam uc-uca ötürmə `tests/ws.test.ts`-də yoxlanılır.
// ===================================================================

function mkDataService() {
  const now = () => 1000;
  const executionEngine = new ExecutionEngine(config, { now, appendTrade: () => {} });
  const healthTracker = new HealthTracker({ log() {}, trade() {}, signal() {}, risk() {}, warn() {}, error() {} }, { now });
  const serverEvents = createServerEvents();
  const dataService = new DataService({
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
  return { dataService, serverEvents };
}

describe("DataService — engine:state emit", () => {
  it("stopEngine çağırılanda serverEvents-də engine:state (paused) emit olunur", () => {
    const { dataService, serverEvents } = mkDataService();
    const received: unknown[] = [];
    onServerEvent(serverEvents, "engine:state", (payload) => received.push(payload));

    dataService.stopEngine("manual (dashboard)");

    expect(received).toEqual([{ engineState: "paused", stateChangedAt: 1000 }]);
  });

  it("startEngine çağırılanda engine:state (running) emit olunur", () => {
    const { dataService, serverEvents } = mkDataService();
    dataService.stopEngine("manual (dashboard)");
    const received: unknown[] = [];
    onServerEvent(serverEvents, "engine:state", (payload) => received.push(payload));

    dataService.startEngine("manual (dashboard)");

    expect(received).toEqual([{ engineState: "running", stateChangedAt: 1000 }]);
  });
});
