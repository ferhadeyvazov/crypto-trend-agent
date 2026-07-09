import type { Candle } from "../types.js";

// ===================================================================
// Binance /api/v3/klines cavabının bir elementi belə görünür:
// [
//   1720512000000,   // 0: openTime (ms)
//   "57123.50",      // 1: open   (string!)
//   "57200.00",      // 2: high
//   "57050.10",      // 3: low
//   "57180.20",      // 4: close
//   "1234.56",       // 5: volume
//   1720515599999,   // 6: closeTime (ms)
//   ... (istifadə etmədiyimiz sahələr)
// ]
// Diqqət: Binance qiymətləri STRING kimi göndərir — number-ə çeviririk.
// ===================================================================

export type RawKline = [
  number, string, string, string, string, string, number,
  ...unknown[],
];

export function parseKline(raw: RawKline): Candle {
  const candle: Candle = {
    openTime: raw[0],
    open: Number(raw[1]),
    high: Number(raw[2]),
    low: Number(raw[3]),
    close: Number(raw[4]),
    volume: Number(raw[5]),
    closeTime: raw[6],
  };

  // NaN yoxlaması: API gözlənilməz format göndərsə, səssizcə davam etmək
  // əvəzinə dərhal partlayırıq. Sənədin prinsipi: "şübhə varsa, dayan."
  for (const [key, value] of Object.entries(candle)) {
    if (typeof value !== "number" || Number.isNaN(value)) {
      throw new Error(`parseKline: '${key}' sahəsi rəqəm deyil: ${String(value)}`);
    }
  }
  return candle;
}

export function parseKlines(raw: RawKline[]): Candle[] {
  return raw.map(parseKline);
}
