import type { DataLayer } from "../data/DataLayer.js";
import type { Candle } from "../data/types.js";
import { TIMEFRAME_MS } from "../data/types.js";
import type { StrategyConfig } from "../config/index.js";
import { computeRegime } from "../signals/regime.js";
import { evaluateSignal } from "../signals/engine.js";
import type { EntrySignalType, Regime, SignalDirection } from "../signals/types.js";
import { evaluateRisk } from "../risk/engine.js";
import { computeOpenRiskPct } from "../risk/portfolioLimits.js";
import type { OpenPositionInfo, PortfolioCandidate } from "../risk/types.js";
import { computeInitialStop } from "../execution/exitRules.js";
import { atr as computeAtrSeries } from "../indicators/index.js";
import type { ExecutionEngine } from "../execution/ExecutionEngine.js";
import type { Logger } from "../logging/index.js";
import { isCoreAsset, type Tier } from "../universe/index.js";

// ===================================================================
// Əsas icra dövrəsi (sənəd, bölmə 9). Hər 1h bar bağlananda universe
// üzrə bir dəfə çağırılır: DataLayer → SignalEngine → RiskManager →
// ExecutionEngine zəncirini icra edir.
//
// İki fazalı icra (bölmə 9 pseudokoduna sadiq): əvvəlcə BÜTÜN aktivlər
// üçün açıq pozisiyalar idarə olunur və yeni siqnal namizədləri toplanır,
// sonra namizədlər ADX(4h)-a görə azalan sırayla RiskManager-dən keçir
// (yüksək ADX-li siqnal portfel limitli yerə önce sahib çıxır).
// ===================================================================

const BTC_SYMBOL = "BTCUSDT";
/** Binance-in USDT cütləri üçün tipik minNotional-ı — exchange-info mənbəyi hələ yoxdur (RiskManager qeydinə bax) */
const DEFAULT_MIN_NOTIONAL = 10;

export interface OrchestratorDeps {
  dataLayer: DataLayer;
  executionEngine: ExecutionEngine;
  logger: Logger;
  config: StrategyConfig;
  /** Cari universe-in Tier1/Tier2 xəritəsi (bax: universeSelector.ts). Xəritədə olmayan simvol TIER1 sayılır. */
  tierMap: Record<string, Tier>;
  /** F2 (spread) — real order book mənbəyi yoxdur, defolt 0 (spread problemsiz sayılır) */
  getSpreadBps?: (symbol: string) => number;
  /** RiskManager-in minNotional-ı — defolt sabit dəyər */
  getMinNotional?: (symbol: string) => number;
  /** Dashboard `signal:new` socket.io hadisəsi üçün (Mərhələ 3) — yeni giriş siqnalı TAPILANDA çağırılır. */
  onSignal?: (signal: { symbol: string; timeframe: "1H"; type: string; createdAt: number }) => void;
  /**
   * Dashboard RegimeStrip/RegimeGrid üçün (Mərhələ 7) — HƏR simvol üçün, data uğurla
   * alındıqdan dərhal sonra (mövqə açıq olsun-olmasın, NO_TRADE olsun-olmasın) çağırılır.
   * Mövcud `logger.signal(...)` çağırışları YALNIZ bəzi hallarda işə düşür (aşağı bax) —
   * bu, universe-in HAMISI üçün "cari rejim"i əldə etməyin yeganə yoludur.
   */
  onRegimeSnapshot?: (snapshot: { symbol: string; regime4h: "bull" | "neutral" | "bear" }) => void;
}

function regimeToBias(regime: Regime): "bull" | "neutral" | "bear" {
  if (regime === "LONG_ONLY") return "bull";
  if (regime === "SHORT_ONLY") return "bear";
  return "neutral";
}

interface SignalCandidate {
  candidate: PortfolioCandidate;
  entryPriceEstimate: number;
  atr1hAtSignal: number;
  signalType: EntrySignalType;
}

interface AssetSnapshot {
  regime4h: Regime;
  atr1hCurrent: number;
}

export async function runCycle(universe: string[], deps: OrchestratorDeps): Promise<void> {
  const { dataLayer, executionEngine, logger, config, tierMap } = deps;
  const getSpreadBps = deps.getSpreadBps ?? (() => 0);
  const getMinNotional = deps.getMinNotional ?? (() => DEFAULT_MIN_NOTIONAL);

  const symbols = universe.includes(BTC_SYMBOL) ? universe : [BTC_SYMBOL, ...universe];
  const minHistory = config.timeframes.minHistoryBars;

  const snapshots = new Map<string, AssetSnapshot>();
  const candidates: SignalCandidate[] = [];

  // ---- Faza 1: data yenilə, açıq pozisiyaları idarə et, yeni siqnalları topla ----
  for (const symbol of symbols) {
    if (dataLayer.isQuarantined(symbol)) {
      logger.warn(`${symbol} karantində — bu dövrə keçilir`, { symbol });
      continue;
    }

    let candles4h: Candle[];
    let candles1h: Candle[];
    try {
      candles4h = await dataLayer.getClosedCandles(symbol, "4h", minHistory);
      candles1h = await dataLayer.getClosedCandles(symbol, "1h", minHistory);
    } catch (err) {
      // §13: data 5 dəqiqə ərzində bərpa olunmasa aktiv karantinə düşür (DataLayer bunu özü edir),
      // qalan sistem işləməyə davam edir — burada sadəcə bu aktivi keçirik.
      logger.error(`${symbol}: data alınmadı`, { symbol, error: String(err) });
      continue;
    }

    const regimeSeries = computeRegime(candles4h, config);
    const regime4h = regimeSeries[regimeSeries.length - 1]!;
    const atr1hSeries = computeAtrSeries(candles1h, config.indicators.atr_1h.period);
    const atr1hCurrent = atr1hSeries[atr1hSeries.length - 1]!;
    snapshots.set(symbol, { regime4h, atr1hCurrent });
    deps.onRegimeSnapshot?.({ symbol, regime4h: regimeToBias(regime4h) });

    const lastCandle1h = candles1h[candles1h.length - 1]!;
    const existingPosition = executionEngine.getPosition(symbol);
    if (existingPosition) {
      executionEngine.onBarClose(symbol, lastCandle1h, { regime4h, atr1hCurrent });
      continue; // F3: pozisiya açıqkən yeni giriş axtarılmır
    }

    if (executionEngine.getSystemState() !== "RUNNING" || executionEngine.isEntriesPaused()) continue;
    if (regime4h === "NO_TRADE") continue;

    const lastTradeCloseTime = executionEngine.getLastTradeCloseTime(symbol);
    const barsSinceLastTrade = lastTradeCloseTime === null
      ? null
      : Math.floor((lastCandle1h.closeTime - lastTradeCloseTime) / TIMEFRAME_MS["1h"]);

    const evaluation = evaluateSignal(
      candles4h,
      candles1h,
      { spreadBps: getSpreadBps(symbol), hasOpenPosition: false, barsSinceLastTrade },
      config,
    );

    if (!evaluation.signal) {
      logger.signal(`${symbol}: siqnal yoxdur`, { symbol, regime: regime4h, rejected: evaluation.rejected });
      continue;
    }

    logger.signal(`${symbol}: ${evaluation.signal.type} siqnalı (${evaluation.signal.direction})`, {
      symbol,
      timeframe: "1H",
      type: evaluation.signal.type,
      direction: evaluation.signal.direction,
      regime: regime4h,
      adx4h: evaluation.signal.adx4h,
    });
    deps.onSignal?.({ symbol, timeframe: "1H", type: evaluation.signal.type, createdAt: lastCandle1h.closeTime });

    candidates.push({
      candidate: {
        symbol,
        direction: evaluation.signal.direction,
        isCoreAsset: isCoreAsset(symbol),
        adx4h: evaluation.signal.adx4h,
        tier: tierMap[symbol] ?? "TIER1",
      },
      // Real fill NÖVBƏTİ bar açılışında olacaq (§10.3) — bu, sizing/stop
      // üçün TƏXMİNİ anchor qiymətdir (cari bağlanmış şamın close-u).
      entryPriceEstimate: lastCandle1h.close,
      atr1hAtSignal: atr1hCurrent,
      signalType: evaluation.signal.type,
    });
  }

  // ---- Faza 2: ADX(4h)-a görə azalan sırala, RiskManager-dən keçir ----
  candidates.sort((a, b) => b.candidate.adx4h - a.candidate.adx4h);
  const btcRegime = snapshots.get(BTC_SYMBOL)?.regime4h ?? "NO_TRADE";

  for (const { candidate, entryPriceEstimate, atr1hAtSignal, signalType } of candidates) {
    const stopPriceEstimate = computeInitialStop(entryPriceEstimate, atr1hAtSignal, candidate.direction, config);
    const equity = executionEngine.getEquity();
    const openPositions: OpenPositionInfo[] = executionEngine.getAllPositions().map((p) => ({
      symbol: p.symbol,
      direction: p.direction as SignalDirection,
      isCoreAsset: isCoreAsset(p.symbol),
      openRiskPct: computeOpenRiskPct(p, entryPriceEstimate, equity),
      tier: p.tier,
    }));

    const riskEval = evaluateRisk(
      candidate,
      { entryPrice: entryPriceEstimate, stopPrice: stopPriceEstimate },
      {
        equity,
        openPositions,
        minNotional: getMinNotional(candidate.symbol),
        btcRegime,
        dailyPnlPct: executionEngine.getDailyPnlPct(),
        weeklyPnlPct: executionEngine.getWeeklyPnlPct(),
        consecutiveLosses: executionEngine.getConsecutiveLosses(),
      },
      config,
    );

    if (!riskEval.approved || !riskEval.sizing) {
      logger.risk(`${candidate.symbol}: siqnal rədd edildi`, { symbol: candidate.symbol, reasons: riskEval.rejected });
      continue;
    }

    const result = executionEngine.queueEntry({
      symbol: candidate.symbol,
      direction: candidate.direction,
      signalType,
      tier: candidate.tier,
      size: riskEval.sizing.positionSize,
      atr1hAtSignal,
      regime4h: snapshots.get(candidate.symbol)!.regime4h,
      adx4h: candidate.adx4h,
    });

    if (result.queued) {
      logger.risk(`${candidate.symbol}: giriş növbəyə qoyuldu`, {
        symbol: candidate.symbol, direction: candidate.direction, size: riskEval.sizing.positionSize,
      });
    } else {
      logger.risk(`${candidate.symbol}: növbəyə qoyulmadı`, { symbol: candidate.symbol, reason: result.reason });
    }
  }
}
