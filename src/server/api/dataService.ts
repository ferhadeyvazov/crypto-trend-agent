import type { StrategyConfig } from "../../config/index.js";
import type { ExecutionEngine } from "../../execution/ExecutionEngine.js";
import type { TradeRecord } from "../../execution/types.js";
import { computeOpenRiskPct } from "../../risk/index.js";
import { buildPerformanceReport } from "../../reporting/report.js";
import { buildEquityCurve } from "../../reporting/equityCurve.js";
import type { HealthTracker } from "../../health/HealthTracker.js";
import { readTrades } from "../storage-adapter/readTrades.js";
import { readSignalEvents } from "../storage-adapter/readSignalEvents.js";
import { toApiPosition, toApiTrade, toApiSignal, toApiEquityPoint, toApiSystemHealth } from "../storage-adapter/toApi.js";
import type {
  Position as ApiPosition,
  Trade as ApiTrade,
  Signal as ApiSignal,
  EquityPoint as ApiEquityPoint,
  SystemHealth as ApiSystemHealth,
  PortfolioSummary,
} from "../../../shared/types.js";

const THIRTY_DAYS_MS = 30 * 24 * 3_600_000;

export interface DataServiceDeps {
  executionEngine: ExecutionEngine;
  config: StrategyConfig;
  healthTracker: HealthTracker;
  now: () => number;
  readFile: (path: string) => Promise<string | null>;
  tradesFilePath: string;
  eventsFilePath: string;
  /** Son keşlənmiş bağlanmış 1h şamın close-u (unrealizedPnl üçün) — BinanceDataLayer.getCachedClose. */
  getCachedClose: (symbol: string) => number | null;
}

/**
 * `/api/*` route-larının bütün data-oxuma məntiqini birləşdirir: ExecutionEngine
 * (canlı yaddaş), trades.jsonl/events.log.jsonl (storage-adapter) və mövcud
 * `src/reporting/*` funksiyalarını (buildPerformanceReport, buildEquityCurve)
 * bir yerə yığır. Route-lar bu servisi çağırır, birbaşa daxili modullara toxunmur.
 */
export class DataService {
  constructor(private readonly deps: DataServiceDeps) {}

  private async loadTrades(): Promise<TradeRecord[]> {
    return readTrades(this.deps.tradesFilePath, { readFile: this.deps.readFile });
  }

  /** Trade jurnalı boşdursa "indi"ni, doludursa ilk giriş vaxtını başlanğıc sayır (təxmini — dəqiq paper-trading go-live tarixi ayrıca izlənmir). */
  private inferStartTime(trades: TradeRecord[]): number {
    if (trades.length === 0) return this.deps.now();
    return Math.min(...trades.map((t) => t.entryTime));
  }

  getPortfolio(): PortfolioSummary {
    const { executionEngine } = this.deps;
    const equity = executionEngine.getEquity();
    const filledPositions = executionEngine.getAllPositions().filter((p) => p.entryPrice !== null);
    const openRiskPct = filledPositions.reduce(
      (sum, p) => sum + computeOpenRiskPct(p, p.entryPrice!, equity),
      0,
    );

    return {
      equity,
      dailyPnlPct: executionEngine.getDailyPnlPct(),
      weeklyPnlPct: executionEngine.getWeeklyPnlPct(),
      openPositionCount: filledPositions.length,
      openRiskPct,
    };
  }

  getPositions(): ApiPosition[] {
    return this.deps.executionEngine
      .getAllPositions()
      .filter((p) => p.entryPrice !== null)
      .map((p) => toApiPosition(p, this.deps.getCachedClose(p.symbol)));
  }

  async getTrades(opts: { limit?: number; symbol?: string }): Promise<ApiTrade[]> {
    let trades = await this.loadTrades();
    if (opts.symbol) trades = trades.filter((t) => t.symbol === opts.symbol);
    trades = [...trades].sort((a, b) => b.exitTime - a.exitTime);
    if (opts.limit !== undefined) trades = trades.slice(0, opts.limit);
    return trades.map(toApiTrade);
  }

  async getSignals(opts: { limit?: number }): Promise<ApiSignal[]> {
    const events = await readSignalEvents(this.deps.eventsFilePath, { readFile: this.deps.readFile });
    let signals = events.map(toApiSignal).filter((s): s is ApiSignal => s !== null);
    signals = signals.sort((a, b) => b.createdAt - a.createdAt);
    if (opts.limit !== undefined) signals = signals.slice(0, opts.limit);
    return signals;
  }

  async getEquityCurve(opts: { from?: number; to?: number }): Promise<ApiEquityPoint[]> {
    const trades = await this.loadTrades();
    const startTime = this.inferStartTime(trades);
    const curve = buildEquityCurve(trades, this.deps.config.paperTrading.initialEquityUsd, startTime);
    const filtered = curve.filter(
      (p) => (opts.from === undefined || p.time >= opts.from) && (opts.to === undefined || p.time <= opts.to),
    );
    return filtered.map(toApiEquityPoint);
  }

  async getMetrics() {
    const trades = await this.loadTrades();
    const startTime = this.inferStartTime(trades);
    const criticalErrorCount30d = this.deps.healthTracker.getErrorCountSince(this.deps.now() - THIRTY_DAYS_MS);
    const report = buildPerformanceReport(trades, this.deps.config, { startTime, criticalErrorCount30d });
    return { metrics: report.metrics, goLive: report.goLive };
  }

  getHealth(): ApiSystemHealth {
    return toApiSystemHealth(this.deps.executionEngine, this.deps.healthTracker, this.deps.now());
  }

  startEngine(reason: string): ApiSystemHealth {
    this.deps.executionEngine.resumeEntries(reason, this.deps.now());
    return this.getHealth();
  }

  stopEngine(reason: string): ApiSystemHealth {
    this.deps.executionEngine.pauseEntries(reason, this.deps.now());
    return this.getHealth();
  }
}
