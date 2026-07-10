import { appendFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";

// ===================================================================
// JsonlLogger üçün real fayl yazıcısı (Node.js adapteri). Log yazıları
// nadir (saatda bir dövrə) olduğundan sync fs kifayətdir — async növbə
// mürəkkəbliyinə ehtiyac yoxdur.
// ===================================================================

export function createNodeFileWriter(filePath: string): (line: string) => void {
  mkdirSync(dirname(filePath), { recursive: true });
  return (line: string) => {
    appendFileSync(filePath, line + "\n", "utf-8");
  };
}
