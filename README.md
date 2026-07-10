# Crypto Trend Agent (v1.0)

"Crypto Trend-Following Trading System v1.0" spesifikasiyasının icrası.
Rejim: PAPER_TRADING (real pul yoxdur). Konfiqurasiya: `src/config/strategy.v1.json`.

## Quraşdırma
```bash
npm install
```

## Testlər
```bash
npm test
```

## TradingView validasiyası (Mərhələ 2 yoxlaması)
```bash
npm run validate
```

## Canlı yoxlama (real Binance datası, trade etmir)
```bash
npm run smoke
```

## Struktur
```
src/
  config/      strategiya konfiqurasiyası (source of truth)
  data/        DataLayer — birjadan şam datası (Mərhələ 1 ✅)
  indicators/  EMA, RSI, ATR, ADX, MACD, Donchian (Mərhələ 2 ✅)
  signals/     SignalEngine — rejim + giriş qaydaları (Mərhələ 3 ✅)
  risk/        RiskManager — sizing + limitlər (Mərhələ 4 ✅)
  execution/   ExecutionEngine — paper trading (Mərhələ 5 ✅)
  reporting/   metrikalar, jurnal, hesabat (Mərhələ 6 ✅)
tests/         unit testlər
scripts/       köməkçi skriptlər (smoke test)
```
