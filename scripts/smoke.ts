// Canlı yoxlama: real Binance API-dən BTCUSDT datası çəkir.
// İşlətmək: npm run smoke
// (Bu, trade etmir — yalnız DataLayer-in real dünyada işlədiyini göstərir.)
import { BinanceDataLayer } from "../src/data/binance/BinanceDataLayer.js";

const dl = new BinanceDataLayer();

for (const tf of ["1h", "4h"] as const) {
  const candles = await dl.getClosedCandles("BTCUSDT", tf, 300);
  const last = candles[candles.length - 1]!;
  console.log(
    `✅ BTCUSDT ${tf}: ${candles.length} bağlanmış şam alındı. ` +
      `Sonuncu: close=${last.close}, bağlanıb=${new Date(last.closeTime).toISOString()}`,
  );
}
console.log("Smoke test uğurlu — DataLayer real bazarla işləyir.");
