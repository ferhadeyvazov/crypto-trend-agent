import { describe, it, expect, afterEach } from "vitest";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { JsonlLogger } from "../src/logging/JsonlLogger.js";
import { createNodeFileWriter } from "../src/logging/nodeFileWriter.js";

describe("JsonlLogger", () => {
  it("hər səviyyə üçün düzgün JSON sətri yazır", () => {
    const lines: string[] = [];
    const logger = new JsonlLogger({ now: () => 12345, write: (line) => lines.push(line) });

    logger.trade("trade bağlandı", { symbol: "BTCUSDT" });
    logger.signal("siqnal yarandı", { type: "PULLBACK" });
    logger.risk("limit pozuldu");
    logger.warn("xəbərdarlıq");
    logger.error("xəta baş verdi");

    expect(lines).toHaveLength(5);
    expect(JSON.parse(lines[0]!)).toEqual({ ts: 12345, level: "TRADE", message: "trade bağlandı", data: { symbol: "BTCUSDT" } });
    expect(JSON.parse(lines[1]!)).toEqual({ ts: 12345, level: "SIGNAL", message: "siqnal yarandı", data: { type: "PULLBACK" } });
    expect(JSON.parse(lines[2]!)).toEqual({ ts: 12345, level: "RISK", message: "limit pozuldu" });
    expect(JSON.parse(lines[3]!)).toEqual({ ts: 12345, level: "WARN", message: "xəbərdarlıq" });
    expect(JSON.parse(lines[4]!)).toEqual({ ts: 12345, level: "ERROR", message: "xəta baş verdi" });
  });

  it("data verilməyibsə sahəni fayla salmır", () => {
    const lines: string[] = [];
    const logger = new JsonlLogger({ now: () => 1, write: (line) => lines.push(line) });
    logger.warn("mesaj");
    expect(JSON.parse(lines[0]!)).not.toHaveProperty("data");
  });
});

describe("createNodeFileWriter", () => {
  let dir: string;

  afterEach(() => {
    if (dir) rmSync(dir, { recursive: true, force: true });
  });

  it("sətirləri append-only olaraq fayla yazır", () => {
    dir = mkdtempSync(join(tmpdir(), "crypto-trend-agent-log-test-"));
    const filePath = join(dir, "nested", "events.log.jsonl");
    const write = createNodeFileWriter(filePath);

    write('{"a":1}');
    write('{"a":2}');

    const content = readFileSync(filePath, "utf-8");
    expect(content.trim().split("\n")).toEqual(['{"a":1}', '{"a":2}']);
  });
});
