import "dotenv/config";
import { config } from "./config/index.js";
import { BinanceDataLayer } from "./data/binance/BinanceDataLayer.js";
import { ExecutionEngine } from "./execution/ExecutionEngine.js";
import type { TradeRecord } from "./execution/types.js";
import { runCycle } from "./orchestrator/runCycle.js";
import { msUntilNextHour, shouldRebalanceUniverse } from "./orchestrator/scheduler.js";
import { JsonlLogger, createNodeFileWriter, type Logger } from "./logging/index.js";
import { FileStatePersistence, createNodeFsStateDeps } from "./state/index.js";
import type { PersistedState } from "./state/types.js";
import {
  UniverseSelector,
  CoinGeckoMarketCapSource,
  BinanceVolumeSource,
  BinancePairChecker,
} from "./universe/index.js";
import { HealthTracker } from "./health/HealthTracker.js";
import { createApiApp } from "./server/api/app.js";
import { createSocketServer } from "./server/ws/index.js";
import { createServerEvents, emitServerEvent } from "./server/serverEvents.js";
import { toApiTrade } from "./server/storage-adapter/toApi.js";

// ===================================================================
// Əsas giriş nöqtəsi (sənəd, bölmə 9 və 13). `npm run start` bunu işə salır.
// Davamlı proses: hər UTC saat sərhədində bir dövrə işlədir, restart-da
// state-i bərpa edir, universe-i həftəlik yeniləyir.
// ===================================================================

const STATE_FILE = "paper-journal/state.json";
const TRADES_FILE = "paper-journal/trades.jsonl";
const EVENTS_FILE = "paper-journal/events.log.jsonl";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * §13: "on restart, the agent first reads ... from the paper state file and
 * restores its internal state. If restoration fails — HALT + report."
 * Xəta baş verərsə burada process.exit çağırmırıq — sadəcə atırıq, main()-in
 * özündəki ümumi catch bloku HALT (process.exit) məsuliyyətini daşıyır. Bu,
 * try/catch-lə birbaşa `let` təyinatını qarışdırmaqdan yaranan kövrək
 * control-flow asılılığından (process.exit-in `never` kimi tanınması) qaçır.
 */
async function loadPersistedState(
  statePersistence: FileStatePersistence,
  logger: Logger,
): Promise<PersistedState | null> {
  try {
    return await statePersistence.load();
  } catch (err) {
    logger.error("State bərpası uğursuz oldu — sistem başladılmır (HALT)", { error: String(err) });
    throw new Error(`State bərpası uğursuz oldu, sistem dayandırılır: ${String(err)}`);
  }
}

async function main(): Promise<void> {
  const now = () => Date.now();

  const statePersistence = new FileStatePersistence(STATE_FILE, createNodeFsStateDeps());
  const tradeWriter = createNodeFileWriter(TRADES_FILE);
  const eventWriter = createNodeFileWriter(EVENTS_FILE);
  const eventLogger = new JsonlLogger({ now, write: eventWriter });
  // HealthTracker JsonlLogger-i "decorate" edir (ERROR-ları /api/health üçün yaddaşda saxlayır) —
  // özü Logger interfeysini implement etdiyi üçün aşağıdakı bütün `logger.*` çağırışları dəyişmir.
  const healthTracker = new HealthTracker(eventLogger, { now });
  const logger: Logger = healthTracker;
  const serverEvents = createServerEvents();
  const appendTrade = (record: TradeRecord) => {
    tradeWriter(JSON.stringify(record));
    emitServerEvent(serverEvents, "trade:closed", toApiTrade(record));
  };

  const persisted = await loadPersistedState(statePersistence, logger);

  const dataLayer = new BinanceDataLayer({ now });
  const executionEngine = persisted
    ? ExecutionEngine.restore(config, { now, appendTrade }, persisted.executionEngine)
    : new ExecutionEngine(config, { now, appendTrade });

  if (persisted) {
    logger.warn("Əvvəlki vəziyyət bərpa olundu", {
      openPositions: persisted.executionEngine.positions.length,
      equity: persisted.executionEngine.equity,
    });
  } else {
    logger.warn("Təzə başlanğıc — əvvəlki state tapılmadı");
  }

  let universe = persisted?.universe ?? [];
  let universeLastRebalanceAt = persisted?.universeLastRebalanceAt ?? null;

  const universeSelector = new UniverseSelector({
    primarySource: new CoinGeckoMarketCapSource(),
    fallbackSource: new BinanceVolumeSource(),
    pairChecker: new BinancePairChecker(),
    onWarning: (msg) => logger.warn(msg),
    topN: 30,
    maxAssets: config.universe.maxAssets,
    minAvgDailyVolumeUsd: config.universe.minAvgDailyVolumeUsd,
  });

  async function persistState(): Promise<void> {
    await statePersistence.save({
      savedAt: now(),
      executionEngine: executionEngine.exportState(),
      universe,
      universeLastRebalanceAt,
    });
  }

  async function refreshUniverseIfNeeded(): Promise<void> {
    if (universe.length > 0 && !shouldRebalanceUniverse(universeLastRebalanceAt, now())) return;
    try {
      universe = await universeSelector.selectUniverse();
      universeLastRebalanceAt = now();
      logger.warn("Universe yeniləndi", { size: universe.length, universe });
    } catch (err) {
      logger.error("Universe yenilənmədi", { error: String(err) });
      if (universe.length === 0) throw err; // ilk başlanğıcda universe tapılmasa davam etmək mənasızdır
    }
  }

  // Dashboard REST API (Mərhələ 2) — eyni prosesdə, aşağıdakı `for(;;)` icra
  // loop-u ilə paralel. `await`-lər event loop-u bloklamadığı üçün eyni prosesdə
  // HTTP server tamamilə mümkündür; server `executionEngine`-ə birbaşa referensla baxır.
  const { app: apiApp, dataService } = createApiApp({
    executionEngine,
    config,
    healthTracker,
    now,
    readFile: createNodeFsStateDeps().readFile,
    tradesFilePath: TRADES_FILE,
    eventsFilePath: EVENTS_FILE,
    getCachedClose: (symbol) => dataLayer.getCachedClose(symbol),
    serverEvents,
  });
  const apiPort = Number(process.env.PORT ?? 4000);
  const httpServer = apiApp.listen(apiPort, () => {
    console.log(`Dashboard API http://localhost:${apiPort} ünvanında dinləyir`);
  });
  // socket.io — eyni http.Server (eyni port), REST-dən ayrı proses YOXDUR (Mərhələ 3).
  createSocketServer(httpServer, dataService, serverEvents);

  console.log(`crypto-trend-agent başladı (rejim: ${config.system.mode})`);

  for (;;) {
    await refreshUniverseIfNeeded();
    try {
      await runCycle(universe, {
        dataLayer,
        executionEngine,
        logger,
        config,
        onSignal: (signal) => emitServerEvent(serverEvents, "signal:new", signal),
      });
    } catch (err) {
      logger.error("Dövrə icra xətası", { error: String(err) });
    }
    await persistState();
    healthTracker.recordCycleCompleted(now());
    // Dashboard canlı snapshot-ları — "canlı" bu sistemdə saatbaşı qranulyarlıqdadır (Mərhələ 3).
    emitServerEvent(serverEvents, "portfolio:update", dataService.getPortfolio());
    emitServerEvent(serverEvents, "position:update", dataService.getPositions());
    emitServerEvent(serverEvents, "health:update", dataService.getHealth());

    const waitMs = msUntilNextHour(now());
    console.log(`Növbəti dövrə ${Math.round(waitMs / 1000)} saniyə sonra (equity: ${executionEngine.getEquity().toFixed(2)}, sistem: ${executionEngine.getSystemState()})`);
    await sleep(waitMs);
  }
}

main().catch((err) => {
  console.error("Kritik xəta:", err);
  process.exit(1);
});
