// ===================================================================
// TradingView validasiyası (sənəd, bölmə 3.1):
// "computed values must match TradingView's values for identical
//  parameters within ±0.5%"
//
// Bu skript real Binance datası (1000 şam — EMA200-ün tam "isinməsi"
// üçün) üzərində indikatorları hesablayır və SON BAĞLANMIŞ şamın
// dəyərlərini çap edir. Sən bu dəyərləri TradingView-də eyni şamla
// tutuşdurursan. İşlətmək: npm run validate
// ===================================================================
import { BinanceDataLayer } from "../src/data/binance/BinanceDataLayer.js";
import { ema, rsi, atr, adx, macd, donchianUpper } from "../src/indicators/index.js";
import type { Timeframe } from "../src/data/types.js";

const SYMBOL = "BTCUSDT";
const BARS = 1000; // EMA200 üçün 300 azdır — seed təsiri tam sönsün deyə 1000

const dl = new BinanceDataLayer();

function fmt(v: number | undefined): string {
  return v === undefined || Number.isNaN(v) ? "—" : v.toFixed(4);
}

for (const tf of ["1h", "4h"] as Timeframe[]) {
  const candles = await dl.getClosedCandles(SYMBOL, tf, BARS);
  const closes = candles.map((c) => c.close);
  const last = candles.length - 1;
  const t = new Date(candles[last]!.closeTime + 1).toISOString();

  console.log(`\n════════ ${SYMBOL} ${tf} — son bağlanmış şam (bağlanış: ${t}) ════════`);
  console.log(`close        = ${fmt(closes[last])}`);
  console.log(`EMA 21       = ${fmt(ema(closes, 21)[last])}`);
  console.log(`EMA 50       = ${fmt(ema(closes, 50)[last])}`);
  console.log(`EMA 200      = ${fmt(ema(closes, 200)[last])}`);
  console.log(`RSI 14       = ${fmt(rsi(closes, 14)[last])}`);
  console.log(`ATR 14       = ${fmt(atr(candles, 14)[last])}`);
  console.log(`ADX 14       = ${fmt(adx(candles, 14)[last])}`);
  console.log(`MACD hist    = ${fmt(macd(closes).histogram[last])}`);
  console.log(`Donchian(20) = ${fmt(donchianUpper(candles, 20)[last])}`);
}

console.log(`
──────────────────────────────────────────────────────────────────
TradingView-də necə yoxlamalı (BINANCE:BTCUSDT, eyni timeframe):
 1) İndikatorları əlavə et: EMA(21/50/200), RSI(14), ATR(14, RMA),
    ADX (indikator adı "DMI" və ya "ADX", DI Length=14, Smoothing=14),
    MACD(12,26,9), Donchian Channels(20).
 2) DİQQƏT: cari (yanıb-sönən) şama YOX, yuxarıda yazılan bağlanış
    vaxtına uyğun ŞAMIN üstünə mouse-u gətir — dəyərlər o şam üçün görünəcək.
 3) Hər dəyəri müqayisə et: fərq ±0.5%-dən az olmalıdır (sənəd, 3.1).
    Donchian üçün qeyd: TradingView upper xətti CARİ şamı da pəncərəyə
    daxil edir, bizdə isə sənədin E-B1 qaydasına görə cari şam XARİCDİR —
    ona görə Donchian-da kiçik fərq NORMALDIR (bir şam sürüşməsi).
──────────────────────────────────────────────────────────────────`);
