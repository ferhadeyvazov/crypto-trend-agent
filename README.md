# Crypto Trend Agent (v1.0 + Fedya_Traider Dashboard)

"Crypto Trend-Following Trading System v1.0" spesifikasiyasının icrası.
Rejim: PAPER_TRADING (real pul yoxdur). Konfiqurasiya: `src/config/strategy.v1.json`.

Backend (paper trading motoru) üzərinə dashboard (REST + socket.io + React frontend)
və Telegram Bridge əlavə olunub. Real trading strategiyası dəyişməyib — bunlar sadəcə
monitorinq/idarəetmə qatlarıdır.

## Quraşdırma
```bash
npm install
```
Dashboard frontend ayrı workspace-dir, `npm install` onu da qurur (`workspaces: ["dashboard"]`).

## Konfiqurasiya (.env)
```bash
cp .env.example .env
```
- `TELEGRAM_BOT_TOKEN` — boş olsa Telegram Bridge tamamilə deaktiv qalır (proses çökmür).
- `ALLOWED_CHAT_IDS` — vergüllə ayrılmış chat ID-lər; yalnız bunlar `/status`, `/trades`,
  `/stop`, `/start` əmrlərini verə və bildiriş ala bilər.
- `CONTROL_TOKEN` — dashboard-ın `POST /api/engine/start|stop` endpoint-lərini qoruyur.
- `PORT` — Express API-nin dinlədiyi port (default 4000).

Sirlər HEÇ VAXT koda yazılmır, yalnız `.env`-də saxlanılır (`.gitignore`-dadır).

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

**pm2 ilə (tövsiyə olunan, davamlı iş üçün):**
```bash
npx pm2 start ecosystem.config.cjs
npx pm2 status
npx pm2 logs crypto-trend-agent
npx pm2 restart crypto-trend-agent
```

**Birbaşa (yalnız qısa müddətli lokal test üçün):**
```bash
npm run start
```

⚠️ **Vacib:** eyni `TELEGRAM_BOT_TOKEN` ilə eyni anda BİRDƏN ARTIQ instansiya
(məs. həm pm2, həm əl ilə `npm run start`/`tsx src/main.ts`) işə salınmamalıdır —
Telegram-ın `getUpdates` long-polling-i yalnız bir istehlakçı qəbul edir, ikincisi
`409 Conflict` xətası ilə susdurulur və bu xəta bir daha öz-özünə düzəlmir (növbəti
`bot.start()` cəhdinə qədər, yəni prosesin yenidən başladılmasına qədər). Motoru pm2
ilə işlətdiyin müddətdə eyni prosesi əl ilə ayrıca başlatma.

Davamlı proses — hər UTC saat sərhədində bir icra dövrəsi işlədir, restart-da
`paper-journal/state.json`-dan bərpa olunur. Loglar və trade jurnalı
`paper-journal/` qovluğunda (git-ə düşmür).

## Dashboard (frontend)
```bash
cd dashboard
npm run dev
```
React + Vite + Tailwind, backend-in REST API-sinə və socket.io axınına qoşulur
(canlı equity/pozisiya/siqnal/health yeniləmələri). Dizayn mənbəyi:
`docs/design/fedya-traider-dashboard-mockup.html`.

## Telegram Bridge
Bot əmrləri: `/status`, `/trades`, `/stop`, `/start`. Yalnız `ALLOWED_CHAT_IDS`-də
olan chat ID-lər cavab alır; digərləri "yalnız icazəli istifadəçilər üçün" mesajı
görür. Trade bağlanışı və kritik xətalar (`error:critical`) icazəli chat-lərə
avtomatik bildiriş kimi göndərilir.

## Struktur
```
src/
  config/           strategiya konfiqurasiyası (source of truth)
  data/             DataLayer — birjadan şam datası
  indicators/       EMA, RSI, ATR, ADX, MACD, Donchian
  signals/          SignalEngine — rejim + giriş qaydaları
  risk/             RiskManager — sizing + limitlər
  execution/        ExecutionEngine — paper trading
  reporting/        metrikalar, jurnal, hesabat
  universe/         Universe seçimi — CoinGecko + Binance fallback
  logging/          TRADE/SIGNAL/RISK/ERROR loqlaması
  state/            restart bərpası üçün state persistence
  orchestrator/     əsas icra dövrəsi + scheduler
  server/
    api/            Express REST API (dashboard üçün)
    ws/             socket.io server (canlı push)
    telegram/       Telegram Bridge (bot, notifier, komandalar)
    storage-adapter/ trade/event fayllarını API formatına çevirir
  main.ts           giriş nöqtəsi (`npm run start` / pm2)
shared/              backend və dashboard arasında paylaşılan tiplər
dashboard/           React frontend (ayrı workspace, öz package.json-u)
tests/               unit testlər
scripts/             köməkçi skriptlər (smoke test, TradingView validasiyası, manual-close, dev fixture server)
paper-journal/       çalışma zamanı yaranan state/log/trade faylları (gitignored)
ecosystem.config.cjs pm2 konfiqurasiyası
```

## Status
60 günlük / minimum 100 trade-lik paper trading dövrü 2026-07-15-də başlayıb
(pm2 ilə davamlı işləyir). Ətraflı yol xəritəsi və mərhələ statusu üçün
`docs/CLAUDE.md`-ə bax.
