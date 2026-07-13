import { config } from "../src/config/index.js";
import { ExecutionEngine } from "../src/execution/ExecutionEngine.js";
import type { TradeRecord } from "../src/execution/types.js";
import { FileStatePersistence, createNodeFsStateDeps } from "../src/state/index.js";
import { createNodeFileWriter } from "../src/logging/index.js";

// Bir dəfəlik əl ilə bağlama skripti: istifadəçi kompüteri bağlamazdan əvvəl
// açıq pozisiyanı cari bazar qiyməti ilə flat etmək istəyəndə istifadə olunur.
// `npm run start` prosesi DAYANDIRILMALIDIR ki, eyni anda state faylını yazıb üstələməsin.

const STATE_FILE = "paper-journal/state.json";
const TRADES_FILE = "paper-journal/trades.jsonl";

async function main(): Promise<void> {
  const symbol = process.argv[2];
  if (!symbol) {
    throw new Error("İstifadə: tsx scripts/manual-close.ts SYMBOL");
  }

  const now = () => Date.now();
  const statePersistence = new FileStatePersistence(STATE_FILE, createNodeFsStateDeps());
  const appendTrade = (record: TradeRecord) => createNodeFileWriter(TRADES_FILE)(JSON.stringify(record));

  const persisted = await statePersistence.load();
  if (!persisted) throw new Error("State faylı tapılmadı");

  const engine = ExecutionEngine.restore(config, { now, appendTrade }, persisted.executionEngine);
  const pos = engine.getPosition(symbol);
  if (!pos) throw new Error(`${symbol} üçün açıq pozisiya yoxdur`);

  const res = await fetch(`https://api.binance.com/api/v3/ticker/price?symbol=${symbol}`);
  const { price } = (await res.json()) as { price: string };
  const exitPrice = Number(price);
  const nowMs = now();

  const candle = {
    openTime: nowMs - 3_600_000,
    open: exitPrice,
    high: exitPrice,
    low: exitPrice,
    close: exitPrice,
    volume: 0,
    closeTime: nowMs,
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (engine as any).closePosition(pos, candle, exitPrice, 0, "MANUAL_CLOSE");

  await statePersistence.save({
    savedAt: nowMs,
    executionEngine: engine.exportState(),
    universe: persisted.universe,
    universeLastRebalanceAt: persisted.universeLastRebalanceAt,
  });

  console.log(`${symbol} manual bağlandı @ ${exitPrice}, yeni equity: ${engine.getEquity().toFixed(2)}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
