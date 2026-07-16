import "dotenv/config";
import { config } from "../src/config/index.js";
import { ExecutionEngine } from "../src/execution/ExecutionEngine.js";
import type { TradeRecord } from "../src/execution/types.js";
import { HealthTracker } from "../src/health/HealthTracker.js";
import { createServerEvents, emitServerEvent } from "../src/server/serverEvents.js";
import { createApiApp } from "../src/server/api/app.js";
import { createSocketServer } from "../src/server/ws/index.js";
import { createTelegramBridge } from "../src/server/telegram/bot.js";
import { toApiTrade } from "../src/server/storage-adapter/toApi.js";
import type { RegimeSnapshot } from "../shared/types.js";

// ===================================================================
// Dashboard frontend inkişafı üçün FIXTURE server (Mərhələ 4-5). Real
// `npm run start` (main.ts) ilə HEÇ BİR ƏLAQƏSİ YOXDUR — real
// `paper-journal/`-a toxunmur, sırf saxta seed data ilə real
// createApiApp/createSocketServer-i işə salır ki, `dashboard`-u real
// trading loop-unu işə salmadan brauzerdə sınamaq mümkün olsun.
// 10 saniyə sonra seed-lənmiş BTCUSDT mövqeyini avtomatik bağlayır ki,
// closed-trade "flash" animasiyası canlı görünə bilsin (Mərhələ 5).
// ===================================================================

async function main(): Promise<void> {
  process.env.CONTROL_TOKEN ??= "dev-token";
  const now = () => Date.now();
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

  const serverEvents = createServerEvents();

  // `appendTrade` faylı ("fayl") VƏ socket-i EYNİ anda yeniləyir — main.ts-dəki
  // eyni pattern (bax src/main.ts) belə ki, demo bağlanışı GET /api/trades-də də görünsün.
  const appendTrade = (record: TradeRecord) => {
    files["trades.jsonl"] += `\n${JSON.stringify(record)}`;
    emitServerEvent(serverEvents, "trade:closed", toApiTrade(record));
  };

  const executionEngine = new ExecutionEngine(config, { now, appendTrade });

  // Seed: 1 açıq (fill olmuş) mövqe — 30 saniyə sonra avtomatik bağlanacaq (aşağı bax).
  // Qeyd: giriş şamının vaxtı REAL cari vaxta əsaslanır (`mkCandle`-in indeks-əsaslı
  // epoch-a yaxın vaxtı YOX) — əks halda bağlananda `entryTime` epoch (1970) olar və
  // `inferStartTime`/`durationDays` hesablamasını (Go-Live Progress) pozar.
  executionEngine.queueEntry({
    symbol: "BTCUSDT", direction: "LONG", signalType: "PULLBACK",
    size: 0.05, atr1hAtSignal: 800, regime4h: "LONG_ONLY", adx4h: 30, tier: "TIER1",
  });
  const entryMs = nowMs - 3_600_000;
  executionEngine.onBarClose(
    "BTCUSDT",
    { openTime: entryMs, open: 67000, high: 67300, low: 66900, close: 67240, volume: 1000, closeTime: entryMs + 3_599_999 },
    { regime4h: "LONG_ONLY", atr1hCurrent: 800 },
  );

  const healthTracker = new HealthTracker(
    { log() {}, trade() {}, signal() {}, risk() {}, warn() {}, error() {} },
    { now },
  );
  healthTracker.recordCycleCompleted(now());
  // Recent log demo (Mərhələ 7) — HealthTracker.recentEvents HAMISINI qeyd edir.
  healthTracker.signal("SOLUSDT: PULLBACK siqnalı (LONG)");
  healthTracker.warn("CoinGecko 429 · Binance həcm fallback-ı istifadə olundu");
  healthTracker.error("ADAUSDT: data alınmadı (nümunə xəta)");

  // Regime snapshot demo (Mərhələ 7) — BTCUSDT açıq mövqə ilə üst-üstə düşür (RegimeStrip-in
  // 1H bar-ı position-dan gələcək), qalanları müxtəlif rejimlər göstərir.
  const regimeSnapshots = new Map<string, RegimeSnapshot>([
    ["BTCUSDT", { symbol: "BTCUSDT", regime4h: "bull", changedAt: nowMs - 5 * 3_600_000 }],
    ["ETHUSDT", { symbol: "ETHUSDT", regime4h: "bull", changedAt: nowMs - 12 * 3_600_000 }],
    ["SOLUSDT", { symbol: "SOLUSDT", regime4h: "neutral", changedAt: nowMs - 2 * 3_600_000 }],
    ["ADAUSDT", { symbol: "ADAUSDT", regime4h: "bear", changedAt: nowMs - 40 * 3_600_000 }],
  ]);

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
    getRegimeSnapshots: () => [...regimeSnapshots.values()],
  });

  const port = Number(process.env.PORT ?? 4000);
  const httpServer = app.listen(port, () => {
    console.log(`Fixture dashboard API: http://localhost:${port} (CONTROL_TOKEN=${process.env.CONTROL_TOKEN})`);
  });
  createSocketServer(httpServer, dataService, serverEvents);

  // Telegram Bridge (Mərhələ 9) — TELEGRAM_BOT_TOKEN yoxdursa deaktiv qalır (dev-safe guard).
  createTelegramBridge({
    token: process.env.TELEGRAM_BOT_TOKEN,
    allowedChatIdsEnv: process.env.ALLOWED_CHAT_IDS,
    dataService,
    serverEvents,
    logger: healthTracker,
  });

  // Canlı siqnal demo-su (Mərhələ 7 yoxlaması: "siqnal real vaxtda") — 15 saniyə sonra
  // yeni bir siqnal event.jsonl-ə əlavə olunur və `signal:new` emit edilir.
  setTimeout(() => {
    const liveSignal = { symbol: "ETHUSDT", timeframe: "1H" as const, type: "BREAKOUT", createdAt: now() };
    files["events.jsonl"] += `\n${JSON.stringify({ ts: liveSignal.createdAt, level: "SIGNAL", message: "ETHUSDT: BREAKOUT siqnalı (LONG)", data: { symbol: "ETHUSDT", timeframe: "1H", type: "BREAKOUT", direction: "LONG", regime: "LONG_ONLY", adx4h: 33 } })}`;
    emitServerEvent(serverEvents, "signal:new", liveSignal);
    console.log("Fixture: yeni siqnal emit olundu (ETHUSDT BREAKOUT) — SignalFeed pulse demo-su.");
  }, 15_000);

  setTimeout(() => {
    const pos = executionEngine.getPosition("BTCUSDT");
    if (!pos) return;
    const closeMs = now();
    const exitCandle = { openTime: closeMs - 3_600_000, open: 67450, high: 67600, low: 67400, close: 67580, volume: 1000, closeTime: closeMs };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (executionEngine as any).closePosition(pos, exitCandle, 67580, 0, "X1_INITIAL_STOP");
    // Real main.ts-də portfolio:update/position:update HƏR DÖVRƏ sonunda (saatbaşı) emit olunur,
    // trade:closed-dən AYRI (bax Mərhələ 3) — fixture-də "dövrə" yoxdur, ona görə bağlanışdan
    // sonra bu snapshot-ları əl ilə təkrarlayırıq ki, Overview də canlı sinxronlaşsın.
    emitServerEvent(serverEvents, "portfolio:update", dataService.getPortfolio());
    emitServerEvent(serverEvents, "position:update", dataService.getPositions());
    console.log("Fixture: BTCUSDT canlı olaraq bağlandı (closed-trade animasiyası demo-su).");
  }, 30_000);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
