import type { Candle } from "../data/types.js";
import type { StrategyConfig } from "../config/index.js";
import type { Regime, SignalDirection, EntrySignalType } from "../signals/types.js";
import { checkLossLimits } from "../risk/lossLimits.js";
import {
  computeInitialStop,
  computeTp1,
  updateChandelierStop,
  isRegimeFlipped,
  isTimeStopHit,
} from "./exitRules.js";
import { simulateEntryFill, resolveOpenFullBarOutcome, resolveOpenRunnerBarOutcome } from "./fillSimulation.js";
import { computeCommission, computeSlippagePct, applySlippage } from "./costModel.js";
import { evaluateSystemState, INITIAL_SYSTEM_STATE, type SystemStateInfo, type SystemState } from "./systemState.js";
import type { Position, TradeRecord, ExitReason, EngineStateLogEntry } from "./types.js";
import type { Tier } from "../universe/index.js";

// ===================================================================
// ExecutionEngine (sənəd, bölmə 6, 9, 10). Per-asset pozisiya dövrəsini,
// fill simulyasiyasını, xərc modelini və trade jurnalını idarə edir.
// DataLayer konvensiyası ilə eyni: `now()` və `appendTrade` konstruktordan
// inject olunur (testlərdə saxtalaşdırıla bilsin).
// ===================================================================

export interface ExecutionEngineDeps {
  now: () => number;
  appendTrade: (record: TradeRecord) => void;
}

export interface QueueEntryParams {
  symbol: string;
  direction: SignalDirection;
  signalType: EntrySignalType;
  tier: Tier;
  /** RiskManager-in hesabladığı ölçü (§7) */
  size: number;
  /** Siqnal barının ATR14(1h)-ı — X1/X2 düsturları bunun üzərində qurulur */
  atr1hAtSignal: number;
  regime4h: Regime;
  adx4h: number;
}

export interface QueueEntryResult {
  queued: boolean;
  reason?: "SYSTEM_NOT_RUNNING" | "ENTRIES_PAUSED" | "POSITION_ALREADY_OPEN";
}

function utcDayKey(ms: number): string {
  const d = new Date(ms);
  return `${d.getUTCFullYear()}-${d.getUTCMonth()}-${d.getUTCDate()}`;
}

/** Bazar əhatəsi (bölmə 2-dəki "weekly-monday-00:00-UTC" konvensiyası ilə eyni). */
function utcWeekKey(ms: number): string {
  const d = new Date(ms);
  const dayOfWeek = (d.getUTCDay() + 6) % 7; // Bazar ertəsi = 0
  const monday = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - dayOfWeek);
  return new Date(monday).toISOString();
}

/** §13 restart bərpası üçün: ExecutionEngine-in bütün daxili vəziyyətinin JSON-a uyğun görüntüsü. */
export interface ExecutionEngineSnapshot {
  positions: Position[];
  equity: number;
  systemStateInfo: SystemStateInfo;
  consecutiveLosses: number;
  dailyRealizedPnl: number;
  weeklyRealizedPnl: number;
  dailyEquityBase: number;
  weeklyEquityBase: number;
  currentDayKey: string | null;
  currentWeekKey: string | null;
  tradeCounter: number;
  /** [symbol, sonBağlanmışTradeninCloseTime-i][] (F4 cooldown üçün) */
  lastTradeCloseTimes: [string, number][];
  /** Manual pause-entries (Engine Control, Mərhələ 2) — avtomatik SystemState-dən ayrı. */
  entriesPaused: boolean;
  engineStateLog: EngineStateLogEntry[];
}

export class ExecutionEngine {
  private positions = new Map<string, Position>();
  private equity: number;
  private systemStateInfo: SystemStateInfo = INITIAL_SYSTEM_STATE;
  private consecutiveLosses = 0;
  private dailyRealizedPnl = 0;
  private weeklyRealizedPnl = 0;
  private dailyEquityBase: number;
  private weeklyEquityBase: number;
  private currentDayKey: string | null = null;
  private currentWeekKey: string | null = null;
  private tradeCounter = 0;
  /** F4 (cooldown) üçün: hər simvolun son bağlanmış trade-inin closeTime-i */
  private lastTradeCloseTime = new Map<string, number>();
  /** Manual pause-entries (Engine Control, Mərhələ 2) — avtomatik SystemState-dən ayrı, dashboard/Telegram start/stop bunu idarə edir. */
  private entriesPaused = false;
  private engineStateLog: EngineStateLogEntry[] = [];

  constructor(private config: StrategyConfig, private deps: ExecutionEngineDeps) {
    this.equity = config.paperTrading.initialEquityUsd;
    this.dailyEquityBase = this.equity;
    this.weeklyEquityBase = this.equity;
  }

  getEquity(): number {
    return this.equity;
  }

  getSystemState(): SystemState {
    return this.systemStateInfo.state;
  }

  getPosition(symbol: string): Position | undefined {
    return this.positions.get(symbol);
  }

  /** Bütün hazırda açıq pozisiyalar (RiskManager-in portfel yoxlaması üçün). */
  getAllPositions(): Position[] {
    return [...this.positions.values()];
  }

  /** F4 (cooldown) hesablaması üçün — heç trade olmayıbsa null. */
  getLastTradeCloseTime(symbol: string): number | null {
    return this.lastTradeCloseTime.get(symbol) ?? null;
  }

  /** Manual pause-entries (Engine Control) hazırda aktivdirmi? */
  isEntriesPaused(): boolean {
    return this.entriesPaused;
  }

  /** Start/stop jurnalı — ən köhnədən ən yeniyə. */
  getEngineStateLog(): EngineStateLogEntry[] {
    return [...this.engineStateLog];
  }

  /** Dashboard/Telegram "stop" əmri: yeni girişlər dayanır, açıq mövqelər idarə olunmağa davam edir. */
  pauseEntries(reason: string, now: number): void {
    this.entriesPaused = true;
    this.engineStateLog.push({ paused: true, changedAt: now, reason });
  }

  /** Dashboard/Telegram "start" əmri: yeni girişlər yenidən aktivləşir. */
  resumeEntries(reason: string, now: number): void {
    this.entriesPaused = false;
    this.engineStateLog.push({ paused: false, changedAt: now, reason });
  }

  /** §13 restart bərpası: cari vəziyyəti JSON-a uyğun formada çıxarır. */
  exportState(): ExecutionEngineSnapshot {
    return {
      positions: this.getAllPositions(),
      equity: this.equity,
      systemStateInfo: this.systemStateInfo,
      consecutiveLosses: this.consecutiveLosses,
      dailyRealizedPnl: this.dailyRealizedPnl,
      weeklyRealizedPnl: this.weeklyRealizedPnl,
      dailyEquityBase: this.dailyEquityBase,
      weeklyEquityBase: this.weeklyEquityBase,
      currentDayKey: this.currentDayKey,
      currentWeekKey: this.currentWeekKey,
      tradeCounter: this.tradeCounter,
      lastTradeCloseTimes: [...this.lastTradeCloseTime.entries()],
      entriesPaused: this.entriesPaused,
      engineStateLog: [...this.engineStateLog],
    };
  }

  /** §13 restart bərpası: verilmiş snapshot-dan yeni ExecutionEngine yaradır. */
  static restore(config: StrategyConfig, deps: ExecutionEngineDeps, snapshot: ExecutionEngineSnapshot): ExecutionEngine {
    const engine = new ExecutionEngine(config, deps);
    // Tier2 dəyişikliyindən əvvəlki snapshot-larda `tier` sahəsi yoxdur — entriesPaused/
    // engineStateLog-dakı kimi köhnə pozisiyalar TIER1 sayılır (Tier2-dən əvvəl yalnız
    // TIER1 universe mövcud idi, ona görə bu, düzgün defoltdur, sadəcə "naməlum" deyil).
    engine.positions = new Map(snapshot.positions.map((p) => [p.symbol, { ...p, tier: p.tier ?? "TIER1" }]));
    engine.equity = snapshot.equity;
    engine.systemStateInfo = snapshot.systemStateInfo;
    engine.consecutiveLosses = snapshot.consecutiveLosses;
    engine.dailyRealizedPnl = snapshot.dailyRealizedPnl;
    engine.weeklyRealizedPnl = snapshot.weeklyRealizedPnl;
    engine.dailyEquityBase = snapshot.dailyEquityBase;
    engine.weeklyEquityBase = snapshot.weeklyEquityBase;
    engine.currentDayKey = snapshot.currentDayKey;
    engine.currentWeekKey = snapshot.currentWeekKey;
    engine.tradeCounter = snapshot.tradeCounter;
    engine.lastTradeCloseTime = new Map(snapshot.lastTradeCloseTimes);
    // `entriesPaused`/`engineStateLog` Mərhələ 2-də əlavə olunub — köhnə (bu sahələr
    // olmayan) state fayllarından bərpada defolt (pauzasız, boş jurnal) istifadə olunur.
    engine.entriesPaused = snapshot.entriesPaused ?? false;
    engine.engineStateLog = snapshot.engineStateLog ?? [];
    return engine;
  }

  /**
   * RiskManager-in təsdiqlədiyi siqnalı növbəyə qoyur. Faktiki fill NÖVBƏTİ
   * bar bağlananda (onBarClose) həmin barın open-i ilə baş verəcək (§10.3).
   */
  queueEntry(params: QueueEntryParams): QueueEntryResult {
    if (this.systemStateInfo.state !== "RUNNING") {
      return { queued: false, reason: "SYSTEM_NOT_RUNNING" };
    }
    if (this.entriesPaused) {
      return { queued: false, reason: "ENTRIES_PAUSED" };
    }
    if (this.positions.has(params.symbol)) {
      return { queued: false, reason: "POSITION_ALREADY_OPEN" };
    }
    this.positions.set(params.symbol, {
      symbol: params.symbol,
      direction: params.direction,
      state: "PENDING_ENTRY",
      signalType: params.signalType,
      tier: params.tier,
      originalSize: params.size,
      remainingSize: params.size,
      entryTime: null,
      entryPrice: null,
      atr1hAtEntry: params.atr1hAtSignal,
      regime4hAtEntry: params.regime4h,
      adx4hAtEntry: params.adx4h,
      initialStop: NaN,
      stop: NaN,
      tp1Price: NaN,
      tp1Filled: false,
      extremeSinceEntry: NaN,
      barsSinceEntry: 0,
      realizedGrossPnl: 0,
      realizedFees: 0,
      realizedSlippageCost: 0,
      lastExitTime: 0,
      lastExitPrice: 0,
      lastExitReason: "X1_INITIAL_STOP",
    });
    return { queued: true };
  }

  /** Hər 1h bar bağlananda, bu simvol üçün çağırılır. */
  onBarClose(symbol: string, candle: Candle, context: { regime4h: Regime; atr1hCurrent: number }): void {
    this.rollDailyWeeklyIfNeeded(candle.closeTime);

    const pos = this.positions.get(symbol);
    if (pos) {
      const barDollarVolume = candle.volume * candle.close;

      if (pos.state === "PENDING_ENTRY") {
        this.fillEntry(pos, candle, barDollarVolume);
      }

      if (this.positions.has(symbol)) {
        this.processOpenPosition(pos, candle, context, barDollarVolume);
      }
    }

    this.refreshSystemState(candle.closeTime);
  }

  private fillEntry(pos: Position, candle: Candle, barDollarVolume: number): void {
    const orderNotionalEstimate = pos.originalSize * candle.open;
    const { price } = simulateEntryFill(candle, pos.direction, orderNotionalEstimate, barDollarVolume, this.config);

    pos.entryPrice = price;
    pos.entryTime = candle.openTime;
    pos.initialStop = computeInitialStop(price, pos.atr1hAtEntry, pos.direction, this.config);
    pos.stop = pos.initialStop;
    pos.tp1Price = computeTp1(price, pos.atr1hAtEntry, pos.direction, this.config);
    pos.extremeSinceEntry = pos.direction === "LONG" ? candle.high : candle.low;
    pos.state = "OPEN_FULL";

    const entryNotional = pos.originalSize * price;
    pos.realizedFees += computeCommission(entryNotional, this.config);
    pos.realizedSlippageCost += Math.abs(price - candle.open) * pos.originalSize;
  }

  private processOpenPosition(
    pos: Position,
    candle: Candle,
    context: { regime4h: Regime; atr1hCurrent: number },
    barDollarVolume: number,
  ): void {
    pos.barsSinceEntry += 1;
    pos.extremeSinceEntry = pos.direction === "LONG"
      ? Math.max(pos.extremeSinceEntry, candle.high)
      : Math.min(pos.extremeSinceEntry, candle.low);

    if (pos.state === "OPEN_FULL") {
      const orderNotional = pos.remainingSize * pos.stop;
      const outcome = resolveOpenFullBarOutcome(
        candle, pos.stop, pos.tp1Price, pos.direction, orderNotional, barDollarVolume, this.config,
      );
      if (outcome.type === "STOP") {
        this.closePosition(pos, candle, outcome.price, outcome.slippagePct, "X1_INITIAL_STOP");
        return;
      }
      if (outcome.type === "TP1") {
        this.partialCloseTp1(pos, candle);
        // Qeyd: trailing-stop yoxlaması bu barda APARILMIR — eyni barın öz
        // high-ından törənən stopu, eyni barın low-u ilə yoxlamaq özünə-istinad
        // riski yaradır. Trailing yoxlaması növbəti bardan başlayır.
      }
    } else if (pos.state === "OPEN_RUNNER") {
      // ƏVVƏLCƏ köhnə (əvvəlki bardan qalan) stop bu barda toxunubmu yoxlanılır —
      // yeni chandelier səviyyəsi YALNIZ bundan sonra hesablanır. Əks halda bu
      // barın öz high-ından törənən stopu elə həmin barın low-u ilə yoxlamaq
      // baxış-önü (look-ahead) qərəzi yaradardı.
      const orderNotional = pos.remainingSize * pos.stop;
      const outcome = resolveOpenRunnerBarOutcome(candle, pos.stop, pos.direction, orderNotional, barDollarVolume, this.config);
      if (outcome.type === "STOP") {
        this.closePosition(pos, candle, outcome.price, outcome.slippagePct, "X3_TRAILING_STOP");
        return;
      }
      pos.stop = updateChandelierStop(pos.stop, pos.extremeSinceEntry, context.atr1hCurrent, pos.direction, this.config);
    }

    // X4: rejim dönüşü — OPEN_FULL və OPEN_RUNNER-in hər ikisinə tətbiq olunur
    if (this.config.exit.closeOnRegimeFlip && isRegimeFlipped(pos.direction, context.regime4h)) {
      const { price, slippagePct } = this.marketExitFill(candle.close, pos.direction, pos.remainingSize, barDollarVolume);
      this.closePosition(pos, candle, price, slippagePct, "X4_REGIME_FLIP");
      return;
    }

    // X5: yalnız hələ OPEN_FULL olub TP1-ə çatmayıblarsa
    if (pos.state === "OPEN_FULL" && isTimeStopHit(pos.barsSinceEntry, this.config)) {
      const { price, slippagePct } = this.marketExitFill(candle.close, pos.direction, pos.remainingSize, barDollarVolume);
      this.closePosition(pos, candle, price, slippagePct, "X5_TIME_STOP");
    }
  }

  /** X4/X5 bazar sifarişi ilə bağlanır (limit/stop deyil) — cari bar close-u + slippage. */
  private marketExitFill(
    closePrice: number,
    direction: SignalDirection,
    size: number,
    barDollarVolume: number,
  ): { price: number; slippagePct: number } {
    const orderNotional = size * closePrice;
    const slippagePct = computeSlippagePct(orderNotional, barDollarVolume, this.config);
    const price = applySlippage(closePrice, direction, "EXIT", slippagePct);
    return { price, slippagePct };
  }

  private partialCloseTp1(pos: Position, candle: Candle): void {
    const closePct = this.config.exit.tp1ClosePct / 100;
    const closeSize = pos.originalSize * closePct;
    const grossPnl = this.directionalPnl(pos.direction, pos.entryPrice!, pos.tp1Price, closeSize);
    const notional = closeSize * pos.tp1Price;
    const fees = computeCommission(notional, this.config);

    pos.realizedGrossPnl += grossPnl;
    pos.realizedFees += fees;
    pos.remainingSize -= closeSize;
    pos.tp1Filled = true;
    pos.lastExitTime = candle.closeTime;
    pos.lastExitPrice = pos.tp1Price;
    pos.lastExitReason = "X2_TP1";

    if (this.config.exit.breakevenAfterTp1) {
      pos.stop = pos.entryPrice!;
    }
    pos.state = "OPEN_RUNNER";
  }

  /** Pozisiyanın qalan hissəsini tam bağlayır, jurnal sətrini yazır və hesabı yeniləyir. */
  private closePosition(
    pos: Position,
    candle: Candle,
    exitPrice: number,
    slippagePct: number,
    reason: ExitReason,
  ): void {
    const closeSize = pos.remainingSize;
    const grossPnlThisLeg = this.directionalPnl(pos.direction, pos.entryPrice!, exitPrice, closeSize);
    const notional = closeSize * exitPrice;
    const feesThisLeg = computeCommission(notional, this.config);
    const slippageCostThisLeg = slippagePct * notional;

    const totalGrossPnl = pos.realizedGrossPnl + grossPnlThisLeg;
    const totalFees = pos.realizedFees + feesThisLeg;
    const totalSlippageCost = pos.realizedSlippageCost + slippageCostThisLeg;
    const netPnl = totalGrossPnl - totalFees;

    this.equity += netPnl;
    this.dailyRealizedPnl += netPnl;
    this.weeklyRealizedPnl += netPnl;
    this.consecutiveLosses = netPnl < 0 ? this.consecutiveLosses + 1 : 0;

    const riskAmount = pos.originalSize * Math.abs(pos.entryPrice! - pos.initialStop);
    this.tradeCounter += 1;

    const record: TradeRecord = {
      id: `${pos.symbol}-${this.deps.now()}-${this.tradeCounter}`,
      symbol: pos.symbol,
      side: pos.direction,
      signalType: pos.signalType,
      tier: pos.tier,
      entryTime: pos.entryTime!,
      entryPrice: pos.entryPrice!,
      stopPrice: pos.initialStop,
      tp1Price: pos.tp1Price,
      size: pos.originalSize,
      exitTime: candle.closeTime,
      exitPrice,
      exitReason: reason,
      grossPnl: totalGrossPnl,
      fees: totalFees,
      slippage: totalSlippageCost,
      netPnl,
      rMultiple: riskAmount > 0 ? netPnl / riskAmount : 0,
      equityAfter: this.equity,
      regime4h: pos.regime4hAtEntry,
      adx4h: pos.adx4hAtEntry,
      atr1h: pos.atr1hAtEntry,
    };
    this.deps.appendTrade(record);
    this.positions.delete(pos.symbol);
    this.lastTradeCloseTime.set(pos.symbol, candle.closeTime);
  }

  private directionalPnl(direction: SignalDirection, entryPrice: number, exitPrice: number, size: number): number {
    return direction === "LONG" ? (exitPrice - entryPrice) * size : (entryPrice - exitPrice) * size;
  }

  private rollDailyWeeklyIfNeeded(nowMs: number): void {
    const dayKey = utcDayKey(nowMs);
    const weekKey = utcWeekKey(nowMs);
    if (this.currentDayKey === null) this.currentDayKey = dayKey;
    if (this.currentWeekKey === null) this.currentWeekKey = weekKey;

    if (dayKey !== this.currentDayKey) {
      this.currentDayKey = dayKey;
      this.dailyRealizedPnl = 0;
      this.dailyEquityBase = this.equity;
    }
    if (weekKey !== this.currentWeekKey) {
      this.currentWeekKey = weekKey;
      this.weeklyRealizedPnl = 0;
      this.weeklyEquityBase = this.equity;
    }
  }

  /** RiskManager-in evaluateRisk-i üçün (Mərhələ 4) — orkestratorun real dəyərlərlə bağlaya bilməsi üçün. */
  getDailyPnlPct(): number {
    return this.dailyEquityBase > 0 ? (this.dailyRealizedPnl / this.dailyEquityBase) * 100 : 0;
  }
  /** Dashboard `/api/portfolio`-nun dollar məbləği üçün (Mərhələ 5) — `getDailyPnlPct`-in xam ($) versiyası. */
  getDailyRealizedPnl(): number {
    return this.dailyRealizedPnl;
  }
  getWeeklyPnlPct(): number {
    return this.weeklyEquityBase > 0 ? (this.weeklyRealizedPnl / this.weeklyEquityBase) * 100 : 0;
  }
  getConsecutiveLosses(): number {
    return this.consecutiveLosses;
  }

  private refreshSystemState(nowMs: number): void {
    const dailyPnlPct = this.getDailyPnlPct();
    const weeklyPnlPct = this.getWeeklyPnlPct();
    const breach = checkLossLimits(dailyPnlPct, weeklyPnlPct, this.consecutiveLosses, this.config);
    this.systemStateInfo = evaluateSystemState(this.systemStateInfo, breach, nowMs, this.config);
  }
}
