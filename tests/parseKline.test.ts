import { describe, it, expect } from "vitest";
import { parseKline, type RawKline } from "../src/data/binance/parseKline.js";

describe("parseKline", () => {
  const raw: RawKline = [
    1720512000000, "57123.50", "57200.00", "57050.10", "57180.20", "1234.56",
    1720515599999, "0", 0, "0", "0", "0",
  ];

  it("Binance-in string qiymətlərini number-ə çevirir", () => {
    const c = parseKline(raw);
    expect(c).toEqual({
      openTime: 1720512000000,
      open: 57123.5,
      high: 57200.0,
      low: 57050.1,
      close: 57180.2,
      volume: 1234.56,
      closeTime: 1720515599999,
    });
  });

  it("zədəli data gələndə (rəqəm olmayan qiymət) xəta atır", () => {
    const broken = [...raw] as RawKline;
    broken[4] = "not-a-number";
    expect(() => parseKline(broken)).toThrow(/close/);
  });
});
