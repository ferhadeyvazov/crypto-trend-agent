import type { ExecutionEngineSnapshot } from "../execution/index.js";

// ===================================================================
// Restart bərpası (sənəd, bölmə 13): "on restart, the agent first reads
// open positions and orders ... from the paper state file and restores
// its internal state. If restoration fails — HALT + report."
// ===================================================================

export interface PersistedState {
  /** Bu snapshot-un yazıldığı vaxt (diaqnostika üçün) */
  savedAt: number;
  executionEngine: ExecutionEngineSnapshot;
  universe: string[];
  /** Universe-in son yenilənmə vaxtı — həftəlik yenilənmə (bazar ertəsi 00:00 UTC) məntiqi üçün */
  universeLastRebalanceAt: number | null;
}
