# CRYPTO TREND-FOLLOWING TRADING SYSTEM
## Complete Execution Specification for an AI Agent — v1.0

Dual Timeframe: 4H (trend) / 1H (entry) • Top 20 Crypto Assets • Paper-Trading Mode Included

> **DIRECTIVE FOR THE AGENT:** This document is the complete and unambiguous specification of
> your trading system. Read it sequentially and treat the JSON configuration in Section 12 as the
> system's source of truth. All rules are deterministic — do not modify any rule based on your own
> judgment. The system MUST start in PAPER_TRADING mode (Section 10) and may switch to live
> trading only after the transition criteria in Section 11 are met AND the user gives explicit approval.
> When in doubt: do NOT open a position, log the event, and report to the user.

*(Bu fayl `crypto-trend-spec.pdf`-in maşın üçün rahat oxunan markdown surətidir — məzmun eynidir.)*

---

## 1. System architecture and operating principle

The system is a dual-timeframe trend-following model. The 4-hour chart determines the
strategic direction (regime) of the market; the 1-hour chart searches for tactical entry points only in
that direction. This separation filters out lower-timeframe noise while preserving a sufficiently high
trade frequency.

The system consists of 4 independent modules, and the agent must build them with this separation:

| Module | Responsibility | Input → Output |
|---|---|---|
| 1. DataLayer | Fetching OHLCV data from the exchange, caching, integrity validation | Exchange API → clean candle arrays |
| 2. SignalEngine | Indicator computation, applying 4H regime + 1H signal rules | Candle data → Signal object |
| 3. RiskManager | Position sizing, portfolio limits, daily loss limit, correlation check | Signal → approved/rejected Order |
| 4. ExecutionEngine | Order submission (paper or live), position tracking, trailing-stop updates | Order → Position + logs |

**Execution cycle:** runs once after each 1-hour bar closes (bar close). No signal is ever evaluated on
unclosed (intrabar) prices — this eliminates the repainting problem. Exception: stop-loss and trailing
checks for open positions may run on every tick/minute.

## 2. Trading universe — selecting the top 20 crypto assets

The agent does NOT work with a fixed list. The universe is dynamic and is rebuilt every Monday at
00:00 UTC using the following rules:

- Take the top 30 crypto assets by market capitalization (CoinGecko/CoinMarketCap API or the exchange's own ranking).
- Exclude: all stablecoins (USDT, USDC, DAI, FDUSD, etc.) and wrapped tokens (WBTC, WETH, stETH and similar derivatives).
- From the remaining list, keep only assets that have a USDT (or USDC) pair on the target exchange AND an average daily volume ≥ 50M USD over the last 30 days.
- The resulting first 20 assets = the active universe. If fewer than 20 remain, work with the available count.
- If an asset leaving the universe has an open position, the position is managed until closed by its own exit rules; new entries in that asset are forbidden.

Reference example (a typical universe as of early 2026 — the agent must verify and refresh this): BTC,
ETH, BNB, SOL, XRP, ADA, DOGE, AVAX, LINK, DOT, TON, TRX, MATIC/POL, LTC, NEAR, UNI, ATOM, XLM, ICP, APT.

## 3. Data requirements and indicator computation

| Parameter | Value | Note |
|---|---|---|
| Data source | Exchange REST/WebSocket API (e.g. Binance) | REAL market data is used even in paper mode |
| Timeframes | 4h (trend), 1h (entry/exit) | Both TFs are maintained in parallel for every asset |
| History depth | Min. 300 bars per TF | Required for EMA200 stabilization |
| Data format | OHLCV: open, high, low, close, volume, closeTime | Only CLOSED bars are valid for signals |
| Integrity check | If a missing bar / gap is detected, the asset is quarantined for 24h | Computing signals on faulty data is forbidden |

### 3.1 Indicator parameters (immutable — fixed in the configuration)

| Indicator | TF | Parameters | Purpose |
|---|---|---|---|
| EMA 50 | 4h | period=50, source=close | Trend direction (fast line) |
| EMA 200 | 4h | period=200, source=close | Trend direction (slow line) |
| ADX | 4h | period=14, Wilder smoothing | Trend strength filter |
| EMA50 slope | 4h | EMA50[0] − EMA50[5] | Trend vitality |
| EMA 21 | 1h | period=21, source=close | Pullback entry zone |
| RSI | 1h | period=14, Wilder | Momentum confirmation |
| MACD | 1h | 12 / 26 / 9 | Alternative momentum confirmation |
| Donchian channel | 1h | period=20 (high/low) | Breakout entry |
| ATR | 1h | period=14, Wilder | Stop distance, volatility filter |
| ATR average | 1h | SMA(ATR14, 50) | "Dead market" filter |
| Volume average | 1h | SMA(volume, 20) | Breakout confirmation |

**Computation rule:** all indicators are computed with industry-standard formulas (Wilder smoothing for
ADX/RSI/ATR). The agent may use an established library (e.g. `technicalindicators` for Node.js, or
ta-lib bindings); computed values must match TradingView's values for identical parameters within
±0.5% (validation test).

## 4. Trend filter — 4-hour layer (context)

For every asset, the regime is computed whenever a 4h bar closes. The regime takes one of three
values: `LONG_ONLY`, `SHORT_ONLY`, `NO_TRADE`.

### Rule R4.1 — LONG_ONLY regime (ALL conditions must hold simultaneously):
1. close(4h) > EMA50(4h) AND
2. EMA50(4h) > EMA200(4h) AND
3. ADX14(4h) ≥ 23 AND
4. EMA50 slope > 0 (current EMA50 value is greater than its value 5 bars ago)

### Rule R4.2 — SHORT_ONLY regime (ALL conditions must hold simultaneously):
1. close(4h) < EMA50(4h) AND
2. EMA50(4h) < EMA200(4h) AND
3. ADX14(4h) ≥ 23 AND
4. EMA50 slope < 0

### Rule R4.3 — NO_TRADE:
If neither R4.1 nor R4.2 holds, the regime is NO_TRADE. In this regime NO new positions are
opened; existing positions continue to be managed by their exit rules (they are not closed
immediately).

> Note: SHORT trading is enabled only if the exchange/account supports margin shorting or futures. In a
> spot-only environment the agent sets `allowShort=false` in the configuration, and the SHORT_ONLY regime
> behaves as NO_TRADE.

## 5. Entry signals — 1-hour layer (execution)

Entries are evaluated only when the regime allows. There are two parallel entry types — if either one
fires, a signal is generated. The rules below are written for LONG; for SHORT all comparisons are
mirrored.

### 5.1 Entry Type A — Pullback

- **E-A1:** In any of the last 3 bars, low(1h) ≤ EMA21(1h) (price touched or dipped below EMA21).
- **E-A2:** The current bar closes bullish: close > open AND close > EMA21.
- **E-A3:** Momentum confirmation (either of the two): RSI14 is within the 40–65 range AND RSI14[0] > RSI14[1] (turning up); OR the MACD histogram crossed from negative to positive (hist[1] < 0 AND hist[0] > 0).
- **E-A4:** Pullback depth is not excessive: no bar closed below EMA21 − 1.5×ATR14 (a deep break is not a pullback — it may be a trend reversal).

### 5.2 Entry Type B — Donchian Breakout

- **E-B1:** close(1h) > the maximum of the last 20 bars (excluding the current bar, Donchian upper).
- **E-B2:** volume(1h) > 1.3 × SMA(volume, 20).
- **E-B3:** The breakout bar is not abnormally large: (high − low) ≤ 3 × ATR14 (an anomalous bar = manipulation risk, do not enter).

### 5.3 Universal entry filters (mandatory for both A and B)

- **F1 — Volatility:** ATR14(1h) ≥ 0.7 × SMA(ATR14, 50). If the market is dead, do not enter.
- **F2 — Spread:** current bid-ask spread ≤ 0.10% (10 bps). Do not enter assets with a wide spread.
- **F3 — Position uniqueness:** if a position is already open in the same asset, no new entry (pyramiding is forbidden in v1.0).
- **F4 — Cooldown:** at least 2 full 1h bars must pass since the last closed trade in the same asset.
- **F5 — Portfolio limits** (Section 8) are not violated.

**Entry price:** market order after the signal bar closes (in paper mode: next bar's open price +
slippage model, Section 10).

## 6. Exit rules — Stop-Loss, Take-Profit, Trailing

| Rule | Formula (LONG) | Explanation |
|---|---|---|
| X1. Initial Stop-Loss | SL = entry − 1.8 × ATR14(1h) | Placed together with the entry. ATR is the value at entry. |
| X2. Partial TP (50%) | TP1 = entry + 1.8 × ATR14 (i.e. +1R) | 50% of the position is closed; SL immediately moves to breakeven. |
| X3. Trailing (remaining 50%) | Chandelier: TS = highestHigh(since entry) − 3.0 × ATR14(current) | Updated on every 1h bar close. TS only ever moves up. |
| X4. Regime-flip exit | If the 4h regime flips to the opposite side (LONG position + SHORT_ONLY regime) | The remaining position is closed at market. |
| X5. Time stop | If the position has not reached TP1 within 72 hours (72 × 1h bars) | The position is fully closed — 'dead capital' is released. |

All stops must be held as real orders on the exchange side (STOP_MARKET) — agent-internal 'mental
stops' alone are forbidden. In paper mode, stop triggering is simulated using bar high/low (Section 10.3).

## 7. Risk management and position sizing

Position sizing formula (identical for all trades):

```
riskAmount   = equity * riskPerTrade   // equity = current capital (paper or live)
stopDistance = |entryPrice - stopPrice| // = 1.8 * ATR14
positionSize = riskAmount / stopDistance // in base-asset units
notional     = positionSize * entryPrice
// Constraint: notional <= equity * 0.20 (one position = max 20% of capital, no leverage in v1.0)
// If notional < the exchange's minNotional -> the trade is SKIPPED (and logged)
```

| Parameter | Value | Explanation |
|---|---|---|
| riskPerTrade | 0.75% (0.0075) | Maximum capital loss per trade (if the stop is hit) |
| Max notional / position | equity × 20% | Concentration limit |
| Leverage | 1x (none) | Leverage is forbidden in v1.0 |
| Daily loss limit | −3% equity (UTC day) | If exceeded: all new entries pause until the next UTC day |
| Consecutive-loss limit | 4 consecutive losses | If exceeded: 12-hour pause + report |
| Weekly loss limit | −6% equity | If exceeded: system HALT, no continuation without user approval |

## 8. Portfolio-level limits

- Maximum simultaneous open positions: **6**.
- Total open risk: the combined risk of all open positions (each one's loss-to-stop) ≤ equity × **3.5%**.
- **Correlation rule:** in the crypto market, altcoins are highly correlated with BTC. Excluding BTC + ETH, a maximum of **4 altcoin positions in the same direction**. If a new signal would exceed this limit — priority goes to the signal with the highest ADX value.
- **BTC regime guard:** when BTC's 4h regime is SHORT_ONLY or NO_TRADE, the ADX requirement for altcoin LONG entries is raised from 23 → **28** (trading against the market leader requires stronger evidence).
- **Multiple signals on the same bar:** signals are executed in descending order of ADX(4h); once the limit is reached, the rest are rejected and logged.

## 9. Execution loop — state machine and pseudocode

Per-asset position states: `FLAT → PENDING_ENTRY → OPEN_FULL → OPEN_RUNNER (after TP1) → FLAT`.
System-level states: `RUNNING / PAUSED_DAILY / PAUSED_STREAK / HALTED`.

```
// ===== ON EVERY 1H BAR CLOSE (across all assets) =====
for asset of universe:
  updateIndicators(asset, '1h')
  if barJustClosed(asset,'4h'): updateIndicators(asset,'4h'); asset.regime = computeRegime(asset)

  // --- managing open positions ---
  pos = positions[asset]
  if pos:
    if pos.state == OPEN_FULL and touched(pos.tp1): closeHalf(pos); pos.stop = pos.entry; pos.state = OPEN_RUNNER
    if pos.state == OPEN_RUNNER: pos.stop = max(pos.stop, chandelier(asset, pos))
    if regimeFlipped(asset, pos): closeAll(pos, 'X4_REGIME_FLIP')
    if barsSinceEntry(pos) >= 72 and pos.state==OPEN_FULL: closeAll(pos, 'X5_TIME_STOP')
    continue // no new entry while a position is open (F3)

  // --- searching for new entries ---
  if systemState != RUNNING: continue
  if asset.regime == NO_TRADE: continue
  if not passesFilters(asset): continue   // F1,F2,F4 + Section 8 limits
  sig = pullbackSignal(asset) or breakoutSignal(asset)
  if sig: queue.push({asset, sig, priority: asset.adx4h})

queue.sortByPriorityDesc()
for s of queue:
  if portfolioLimitsOk(s): openPosition(s)  // sizing per the Section 7 formula
  else: log('REJECTED_PORTFOLIO_LIMIT', s)

// ===== EVERY MINUTE (lightweight check) =====
for pos of openPositions:
  if price <= pos.stop (LONG): executeStop(pos) // the exchange stop order is primary, this is a backup check
checkDailyLossLimit(); checkStreakLimit(); checkWeeklyHalt()
```

## 10. Paper-Trading module — simulation specification

Paper mode uses the SAME code path as live execution — only the final order-submitting layer of the
ExecutionEngine is replaced with a simulator. This minimizes the classic 'works on paper, fails live' problem.

### 10.1 Initial parameters

| Parameter | Value |
|---|---|
| Initial virtual capital | 10,000 USDT |
| Data source | REAL live market data (same API) |
| Mode duration | Minimum 60 days AND minimum 100 closed trades (whichever comes later) |

### 10.2 Cost model (mandatory — a costless simulation is INVALID)

| Component | Model |
|---|---|
| Commission | 0.10% per side (entry + exit = 0.20% of turnover). If the exchange's real taker fee is known, use it. |
| Slippage (market orders) | 0.05% + 0.02% × (orderNotional / 1% of the bar's dollar volume). Minimum 0.05%. |
| Funding (if futures are used) | The real funding rate is applied every 8 hours. |

### 10.3 Fill simulation rules

- **Market entry:** the open price of the bar FOLLOWING the signal bar + slippage.
- **Stop-loss:** when bar low ≤ stop (LONG), a fill at the stop price + slippage is assumed. On a gap (open < stop), the fill is at the open price.
- **TP1 limit:** when bar high ≥ TP1, a fill at the TP1 price is assumed (no slippage is applied to limit orders).
- **If both the stop and the TP are touched within the same bar: CONSERVATIVE rule — the STOP is assumed to have fired first (worst-case assumption).**

### 10.4 Mandatory record-keeping in paper mode

For every trade, one JSON line (append-only trade journal): `id, symbol, side, signalType
(PULLBACK/BREAKOUT), entryTime, entryPrice, stopPrice, tp1Price, size, exitTime, exitPrice,
exitReason (X1–X5), grossPnl, fees, slippage, netPnl, rMultiple, equityAfter, regime4h, adx4h, atr1h`.
This journal is the data source for the Section 11 metrics.

## 11. Performance metrics and self-test criteria

The agent computes and reports the following metrics weekly and at the end of the paper period:

| Metric | Formula / source | Go-live threshold |
|---|---|---|
| Net PnL | Σ netPnl | > 0 |
| Profit Factor | Σ(wins) / \|Σ(losses)\| | ≥ 1.35 |
| Max Drawdown | Maximum peak-to-trough decline of the equity curve | ≤ 12% |
| Win Rate | winners / total | ≥ 38% (normal for a trend system) |
| Average R-multiple | Σ rMultiple / n | ≥ +0.15R |
| Trade count | closed trades | ≥ 100 |
| Duration | calendar days | ≥ 60 days |
| Sharpe (daily) | mean(dailyRet)/std(dailyRet) × √365 | ≥ 1.0 |
| Technical stability | execution errors / crashes | 0 critical errors in the last 30 days |

**Transition rule:** ALL thresholds must be met simultaneously. If they are, the agent prepares a final
report and requests EXPLICIT APPROVAL from the user. Switching to live mode without user approval
is FORBIDDEN. If thresholds are not met: the agent analyzes which metric failed and in which market
regime (trend/chop) the losses were concentrated, and reports — it does NOT change parameters on its own.

**Overfitting warning:** repeatedly 're-optimizing' parameters (ADX threshold, ATR multipliers) against
historical data is forbidden. Changes may only be made by user decision, with a version bump (v1.1) and
a fresh 60-day paper period.

## 12. Machine-readable configuration (JSON)

This block is the system's source of truth. The agent must use it directly as the config file
(layihədə: `src/config/strategy.v1.json`):

```json
{
  "system": { "name": "crypto-trend-dual-tf", "version": "1.0.0",
    "mode": "PAPER_TRADING", "allowShort": false, "baseCurrency": "USDT" },
  "universe": {
    "source": "top-30-marketcap", "exclude": ["stablecoins", "wrapped-tokens"],
    "minAvgDailyVolumeUsd": 50000000, "maxAssets": 20,
    "rebalance": "weekly-monday-00:00-UTC" },
  "timeframes": { "trend": "4h", "execution": "1h", "minHistoryBars": 300 },
  "indicators": {
    "ema_fast_4h": 50, "ema_slow_4h": 200, "adx_4h": { "period": 14, "minLong": 23, "minAltWhenBtcWeak": 28 },
    "emaSlopeLookback": 5,
    "ema_pullback_1h": 21, "rsi_1h": { "period": 14, "min": 40, "max": 65 },
    "macd_1h": [12, 26, 9], "donchian_1h": 20,
    "atr_1h": { "period": 14, "avgPeriod": 50, "minRatio": 0.7 },
    "volumeSma_1h": 20, "breakoutVolumeMult": 1.3, "maxBarRangeAtrMult": 3.0,
    "pullbackMaxDepthAtrMult": 1.5 },
  "entry": { "types": ["PULLBACK", "BREAKOUT"], "maxSpreadBps": 10,
    "cooldownBars1h": 2, "pyramiding": false },
  "exit": { "stopAtrMult": 1.8, "tp1AtrMult": 1.8, "tp1ClosePct": 50,
    "breakevenAfterTp1": true, "trailingAtrMult": 3.0,
    "timeStopBars1h": 72, "closeOnRegimeFlip": true },
  "risk": { "riskPerTrade": 0.0075, "maxNotionalPctPerPosition": 20,
    "leverage": 1, "dailyLossLimitPct": 3.0, "maxConsecutiveLosses": 4,
    "streakPauseHours": 12, "weeklyHaltLossPct": 6.0 },
  "portfolio": { "maxOpenPositions": 6, "maxTotalOpenRiskPct": 3.5,
    "maxSameDirectionAltcoins": 4, "signalPriority": "adx4h_desc" },
  "paperTrading": { "initialEquityUsd": 10000, "feePctPerSide": 0.10,
    "slippage": { "basePct": 0.05, "impactModel": "volume-scaled" },
    "sameBarStopAndTp": "STOP_FIRST",
    "minDays": 60, "minClosedTrades": 100 },
  "goLiveCriteria": { "profitFactorMin": 1.35, "maxDrawdownPct": 12,
    "winRateMin": 0.38, "avgRMultipleMin": 0.15, "sharpeMin": 1.0,
    "requiresExplicitUserApproval": true },
  "ops": { "evaluateOnBarClose": true, "stopOrdersOnExchange": true,
    "quarantineOnDataGapHours": 24, "reportSchedule": "weekly",
    "onUncertainty": "DO_NOT_TRADE_LOG_AND_REPORT" }
}
```

## 13. Operational rules, error handling and logging

- **Restart behavior:** on restart, the agent first reads open positions and orders from the exchange (or from the paper state file) and restores its internal state. If restoration fails — HALT + report.
- **API errors / rate limits:** exponential backoff (1s → 2s → 4s ... max 60s). If data is not restored within 5 minutes, the asset is quarantined; the rest of the system keeps running.
- **Clock synchronization:** the system clock is synchronized with the exchange server time every hour; if the drift exceeds 5 seconds, raise a warning.
- **Log levels:** TRADE (journal, Section 10.4), SIGNAL (every generated/rejected signal + reason code), RISK (limit violations), ERROR. All logs use UTC timestamps, append-only.
- **Weekly report:** equity curve, metrics table (Section 11), best/worst 5 trades, rejected-signal statistics, active-universe changes.
- **Halt command:** if the user issues 'HALT': new entries stop immediately; open positions are, per user choice, either closed immediately or managed by their exit rules.
- **Uncertainty principle:** if any ambiguity arises when applying a rule — no position is opened, the event is logged, and the user is notified. The default behavior is always conservative.

## 14. Legal notice and risk disclaimer

This document is a technical specification and does not constitute financial advice. Cryptocurrency
trading is highly risky; past or simulated results do not guarantee future performance. No strategy
guarantees profit, and a total loss of capital is possible. The decision to deploy with real capital, and
all resulting outcomes, are solely the user's responsibility. The system may be switched to live mode
only after a successful paper-trading period, with the user's explicit approval, and only with an
amount the user is prepared to lose.

— End of document — Version 1.0 — Prepared: 2026-07-08 —
