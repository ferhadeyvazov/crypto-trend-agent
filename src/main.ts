import { config } from "./config/index.js";
import { BinanceDataLayer } from "./data/binance/BinanceDataLayer.js";
import { ExecutionEngine } from "./execution/ExecutionEngine.js";
import type { TradeRecord } from "./execution/types.js";
import { runCycle } from "./orchestrator/runCycle.js";
import { msUntilNextHour, shouldRebalanceUniverse } from "./orchestrator/scheduler.js";
import { JsonlLogger, createNodeFileWriter } from "./logging/index.js";
import { FileStatePersistence, createNodeFsStateDeps } from "./state/index.js";
import type { PersistedState } from "./state/types.js";
import {
  UniverseSelector,
  CoinGeckoMarketCapSource,
  BinanceVolumeSource,
  BinancePairChecker,
} from "./universe/index.js";

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

async function main(): Promise<void> {
  const now = () => Date.now();

  const statePersistence = new FileStatePersistence(STATE_FILE, createNodeFsStateDeps());
  const tradeWriter = createNodeFileWriter(TRADES_FILE);
  const eventWriter = createNodeFileWriter(EVENTS_FILE);
  const logger = new JsonlLogger({ now, write: eventWriter });
  const appendTrade = (record: TradeRecord) => tradeWriter(JSON.stringify(record));

  // §13: "on restart, the agent first reads ... from the paper state file
  // and restores its internal state. If restoration fails — HALT + report."
  let persisted: PersistedState | null;
  try {
    persisted = await statePersistence.load();
  } catch (err) {
    logger.error("State bərpası uğursuz oldu — sistem başladılmır (HALT)", { error: String(err) });
    console.error(`KRİTİK: state bərpası uğursuz oldu, sistem dayandırılır: ${String(err)}`);
    process.exit(1);
  }

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

  console.log(`crypto-trend-agent başladı (rejim: ${config.system.mode})`);

  for (;;) {
    await refreshUniverseIfNeeded();
    try {
      await runCycle(universe, { dataLayer, executionEngine, logger, config });
    } catch (err) {
      logger.error("Dövrə icra xətası", { error: String(err) });
    }
    await persistState();

    const waitMs = msUntilNextHour(now());
    console.log(`Növbəti dövrə ${Math.round(waitMs / 1000)} saniyə sonra (equity: ${executionEngine.getEquity().toFixed(2)}, sistem: ${executionEngine.getSystemState()})`);
    await sleep(waitMs);
  }
}

main().catch((err) => {
  console.error("Kritik xəta:", err);
  process.exit(1);
});
