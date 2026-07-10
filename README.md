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

## Paper trading agentini işə salmaq
```bash
npm run start
```
Davamlı proses — hər UTC saat sərhədində bir icra dövrəsi işlədir, restart-da
`paper-journal/state.json`-dan bərpa olunur. Loglar və trade jurnalı
`paper-journal/` qovluğunda (git-ə düşmür).

## Struktur
```
src/
  config/        strategiya konfiqurasiyası (source of truth)
  data/          DataLayer — birjadan şam datası (Mərhələ 1 ✅)
  indicators/    EMA, RSI, ATR, ADX, MACD, Donchian (Mərhələ 2 ✅)
  signals/       SignalEngine — rejim + giriş qaydaları (Mərhələ 3 ✅)
  risk/          RiskManager — sizing + limitlər (Mərhələ 4 ✅)
  execution/     ExecutionEngine — paper trading (Mərhələ 5 ✅)
  reporting/     metrikalar, jurnal, hesabat (Mərhələ 6 ✅)
  universe/      Universe seçimi — CoinGecko + Binance fallback (Mərhələ 7 ✅)
  logging/       TRADE/SIGNAL/RISK/ERROR loqlaması (Mərhələ 7 ✅)
  state/         restart bərpası üçün state persistence (Mərhələ 7 ✅)
  orchestrator/  əsas icra dövrəsi + scheduler (Mərhələ 7 ✅)
  main.ts        giriş nöqtəsi (`npm run start`)
tests/           unit testlər
scripts/         köməkçi skriptlər (smoke test, TradingView validasiyası)
paper-journal/   çalışma zamanı yaranan state/log/trade faylları (gitignored)
```
