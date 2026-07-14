import type { TradeRecord } from "../../execution/types.js";

// ===================================================================
// `paper-journal/trades.jsonl` (append-only, hər sətir bir TradeRecord)
// oxuyucusu. FileStatePersistence konvensiyası ilə eyni: `readFile`
// inject olunur (testlərdə diskə toxunmadan saxta veriliş verilə bilsin).
// ===================================================================

export interface TradesReaderDeps {
  /** Fayl yoxdursa null qaytarır (xəta atmır) — FileStatePersistence ilə eyni müqavilə. */
  readFile: (path: string) => Promise<string | null>;
}

/** Korlanmış/yarımçıq sətirlər (append-only faylın axırına düşə bilər) sükutla atlanır. */
export async function readTrades(filePath: string, deps: TradesReaderDeps): Promise<TradeRecord[]> {
  const content = await deps.readFile(filePath);
  if (content === null) return [];

  const trades: TradeRecord[] = [];
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (trimmed.length === 0) continue;
    try {
      trades.push(JSON.parse(trimmed) as TradeRecord);
    } catch {
      continue;
    }
  }
  return trades;
}
