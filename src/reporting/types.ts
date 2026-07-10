// ===================================================================
// Reporting tipləri (sənəd, bölmə 11).
// ===================================================================

export interface EquityPoint {
  time: number;
  equity: number;
}

export interface PerformanceMetrics {
  netPnl: number;
  /** Qazancların itkilərə nisbəti. İtki yoxdursa: qazanc varsa Infinity, yoxdursa 0. */
  profitFactor: number;
  maxDrawdownPct: number;
  /** 0-1 fraksiya (0.42 = 42%) */
  winRate: number;
  avgRMultiple: number;
  tradeCount: number;
  durationDays: number;
  sharpe: number;
  /** Xarici mənbədən (ExecutionEngine hələ struktur xəta izləməsi aparmır) — çağıran verir */
  criticalErrorCount30d: number;
}

export interface GoLiveEvaluation {
  eligible: boolean;
  /** Ödənməyən meyarların adları */
  failed: string[];
  requiresExplicitUserApproval: boolean;
}
