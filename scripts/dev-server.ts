import { config } from "../src/config/index.js";
import { ExecutionEngine } from "../src/execution/ExecutionEngine.js";
import type { TradeRecord } from "../src/execution/types.js";
import { HealthTracker } from "../src/health/HealthTracker.js";
import { createServerEvents } from "../src/server/serverEvents.js";
import { createApiApp } from "../src/server/api/app.js";
import { createSocketServer } from "../src/server/ws/index.js";

// ===================================================================
// Dashboard frontend inkişafı üçün FIXTURE server (Mərhələ 4). Real
// `npm run start` (main.ts) ilə HEÇ BİR ƏLAQƏSİ YOXDUR — real
// `paper-journal/`-a toxunmur, sırf saxta seed data ilə real
// createApiApp/createSocketServer-i işə salır ki, `dashboard`-u real
// trading loop-unu işə salmadan brauzerdə sınamaq mümkün olsun.
// ===================================================================

function mkCandle(i: number, open: number, high: number, low: number, close: number) {
  return { openTime: i * 3_600_000, open, high, low, close, volume: 1000, closeTime: (i + 1) * 3_600_000 - 1 };
}

async function main(): Promise<void> {
  process.env.CONTROL_TOKEN ??= "dev-token";
  const now = () => Date.now();

  const trades: TradeRecord[] = [];
  const executionEngine = new ExecutionEngine(config, { now, appendTrade: (r) => trades.push(r) });

  // Seed: 1 açıq (fill olmuş) mövqe.
  executionEngine.queueEntry({
    symbol: "BTCUSDT", direction: "LONG", signalType: "PULLBACK",
    size: 0.05, atr1hAtSignal: 800, regime4h: "LONG_ONLY", adx4h: 30,
  });
  executionEngine.onBarClose("BTCUSDT", mkCandle(0, 67000, 67300, 66900, 67240), {
    regime4h: "LONG_ONLY", atr1hCurrent: 800,
  });

  const nowMs = now();
  const seedTrades: TradeRecord[] = [
    {
      id: "seed-1", symbol: "ETHUSDT", side: "LONG", signalType: "PULLBACK",
      entryTime: nowMs - 3 * 3_600_000, entryPrice: 3412, stopPrice: 3350, tp1Price: 3500, size: 1,
      exitTime: nowMs - 3_600_000, exitPrice: 3486, exitReason: "X3_TRAILING_STOP",
      grossPnl: 74, fees: 3.8, slippage: 0, netPnl: 74.2, rMultiple: 1.2,
      equityAfter: config.paperTrading.initialEquityUsd + 74.2,
      regime4h: "LONG_ONLY", adx4h: 27, atr1h: 40,
    },
    {
      id: "seed-2", symbol: "BTCUSDT", side: "LONG", signalType: "BREAKOUT",
      entryTime: nowMs - 26 * 3_600_000, entryPrice: 65880, stopPrice: 65200, tp1Price: 67000, size: 0.03,
      exitTime: nowMs - 20 * 3_600_000, exitPrice: 65210, exitReason: "X1_INITIAL_STOP",
      grossPnl: -20, fees: 2, slippage: 0.1, netPnl: -41.3, rMultiple: -1,
      equityAfter: config.paperTrading.initialEquityUsd, regime4h: "LONG_ONLY", adx4h: 31, atr1h: 700,
    },
  ];

  const seedEvents = [
    { ts: nowMs - 300_000, level: "SIGNAL", message: "SOLUSDT: PULLBACK siqnalı (LONG)", data: { symbol: "SOLUSDT", timeframe: "1H", type: "PULLBACK", direction: "LONG", regime: "LONG_ONLY", adx4h: 29 } },
    { ts: nowMs - 3_600_000, level: "SIGNAL", message: "BTCUSDT: BREAKOUT siqnalı (LONG)", data: { symbol: "BTCUSDT", timeframe: "1H", type: "BREAKOUT", direction: "LONG", regime: "LONG_ONLY", adx4h: 31 } },
  ];

  const files: Record<string, string> = {
    "trades.jsonl": seedTrades.map((t) => JSON.stringify(t)).join("\n"),
    "events.jsonl": seedEvents.map((e) => JSON.stringify(e)).join("\n"),
  };

  const healthTracker = new HealthTracker(
    { log() {}, trade() {}, signal() {}, risk() {}, warn() {}, error() {} },
    { now },
  );
  healthTracker.recordCycleCompleted(now());
  const serverEvents = createServerEvents();

  const { app, dataService } = createApiApp({
    executionEngine,
    config,
    healthTracker,
    now,
    readFile: async (path: string) => (path in files ? files[path]! : null),
    tradesFilePath: "trades.jsonl",
    eventsFilePath: "events.jsonl",
    getCachedClose: (symbol) => (symbol === "BTCUSDT" ? 67450 : null),
    serverEvents,
  });

  const port = Number(process.env.PORT ?? 4000);
  const httpServer = app.listen(port, () => {
    console.log(`Fixture dashboard API: http://localhost:${port} (CONTROL_TOKEN=${process.env.CONTROL_TOKEN})`);
  });
  createSocketServer(httpServer, dataService, serverEvents);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
