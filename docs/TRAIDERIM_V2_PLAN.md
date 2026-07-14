# Traiderim v2 (Dashboard) — Development Plan

> Status: FINAL — bütün qərarlar istifadəçi ilə razılaşdırılıb.
> Dizayn mockup-u təsdiqlənib: `traiderim-dashboard-mockup.html` (tokenlər Stage 4-də Tailwind theme-ə köçürülür).
> İş qaydası: hər mərhələdən sonra STOP → nəticə göstərilir → istifadəçi təsdiqi → növbəti mərhələ.

## Qətiləşmiş qərarlar (xülasə)

- **Git:** hazırkı vəziyyətdən `v1` branch → bütün iş `v2` branch-ində → Stage 8 testlərindən sonra `v2` → `main` merge.
- **Storage:** mövcud v1 saxlama formatı qalır (SQL keçidi ləğv edilib) — üzərinə `storage-adapter` oxuma qatı.
- **HTTP:** axios, tək instance (`lib/http.ts`), yalnız response interceptor (xəta normalizasiyası → `ApiError`). Request interceptor yoxdur (auth yoxdur); auth gələrsə əlavə olunur.
- **Server state:** TanStack Query; socket.io hadisələri `queryClient.setQueryData` ilə eyni cache-ə yazılır.
- **Client state:** `useState` + lift; app-wide üçün kiçik Context (socket bağlantısı). Redux/Zustand YOXDUR. Dönüş şərti: post-MVP-də mürəkkəb yazılan client state yaranarsa → Zustand.
- **Qat qaydası:** `Component → hook → api-client → lib/http.ts`. Komponentlər birbaşa axios çağırmır. Pozulma testi: API sahə adı dəyişəndə komponent faylına toxunmaq lazım gəlirsə, qatlar pozulub.
- **i18n:** react-i18next, EN/AZ/TR. Texniki terminlər (P&L, drawdown, LONG, rule code) tərcümə olunmur.
- **Dizayn:** dark "real-time monitoring" — bg `#0B1120`, panel `#111A2E`, border `#243047`, amber `#F59E0B`, green `#22C55E`, red `#EF4444`; Inter (UI) + JetBrains Mono tabular nums (rəqəmlər). İmza elementi: RegimeStrip (4H+1H bar-lar, bütün səhifələrdə). Mobil: bottom nav (≤820px), cədvəllər scroll wrapper-də. Footer: copyright + "not financial advice" + versiya.
- **RegimeStrip düzəliş (mockup-u override edir):** Mockup-da "1H bias"
  yazılıb — bu, spesifikasiyada mövcud olmayan uydurma ölçüdür, İGNOR ET.
  Əvəzinə: üst göstərici = 4H regime (bull/bear/neutral), alt göstərici =
  açıq mövqe statusu (long/short/yoxdur). Alt göstərici vizual olaraq
  fərqli formada olmalıdır (bar deyil, dairə/nöqtə) ki, rejimlə
  qarışmasın. Legend: "4H regime | position". Data mənbəyi:
  /api/positions + position:update. RegimeGrid cədvəlindəki "1H bias"
  sütunu → "Position" sütunu.
- **Engine Control:** "Ticarəti dayandır" = **pause entries** — yeni girişlər icra olunmur, açıq mövqelər idarə olunmağa davam edir (stop/target işləyir). Full halt YOXDUR. Hər start/stop timestamp + səbəb ilə loglanır və Health-də görünür; pauzada keçən günlər paper günü sayılmır. Yazma endpoint-ləri `X-Control-Token` header-i (env-dən) tələb edir; UI-da təsdiq dialoqu məcburidir.
- **Telegram Bridge:** bildirişlər və əmrlər üçün bot mövcud Node prosesinin İÇİNDƏ modul kimi işləyir (grammY) — Hermes və ya ayrıca servis YOXDUR. Bildirişlər socket.io emit nöqtələrinə qoşulur; `/stop` və `/start` əmrləri mövcud engine control funksiyalarını çağırır (eyni pause semantikası, eyni loglama). Yalnız icazəli chat ID-lər (env-dən) əmr verə bilər.
- **AI rolu:** treyd qərarları LLM-ə verilmir — qərarlar deterministik mühərrikdə qalır. AI (Claude API) yalnız hesabat/analiz qatındadır (post-MVP `/report`).
- **İntizam:** strategiya parametrlərinə toxunulmur; dəyişiklik = hypothesis + version bump + yeni 60 günlük paper test.

## 1. MVP scope

- **Portfolio Overview** — equity, günlük/ümumi P&L (realized/unrealized), açıq mövqe sayı, risk məruzəsi.
- **Open Positions & Trade History** — canlı mövqelər; bağlanmış treydlər rule code, exit reason, P&L və filtrlərlə.
- **Signal Monitor** — 4H regime + 1H siqnallar canlı; RegimeStrip hər səhifədə.
- **Performance & Go-Live Progress** — equity curve, win rate, max DD, profit factor; 60 gün / 100 treyd / DD<8% progress barları.
- **System Health** — scheduler, son fetch, socket statusu, loglar.
- **i18n (EN/AZ/TR)** — header-dən keçid.
- **Engine Control** — header-də Start/Stop toggle (pause-entries semantikası), təsdiq dialoqu ilə; engine statusu (`running / paused`) həmişə görünür.
- **Telegram Bridge** — treyd açılış/bağlanış, siqnal, xəta və engine state bildirişləri; `/status`, `/trades`, `/stop`, `/start` əmrləri (chat ID qoruması ilə).

## 2. Post-MVP roadmap

- Strategy Parameters Viewer (next) — read-only spec görünüşü.
- Claude Daily Report (next) — `/report` əmri: günün strukturlaşdırılmış datası Anthropic API-yə göndərilir, insan dilində xülasə qayıdır. Qərar mexanizminə toxunmur.
- Hypothesis Analyzer (later) — Model B: dövri (aylıq) Claude analizi, toplanmış nəticələrdən hipotez təklifi Telegram-a. Təkliflər avtomatik tətbiq olunmur — qəbul yalnız version bump + yeni 60 günlük paper test ilə.
- Brauzer bildirişləri (later).
- Backtest Comparison View (later).
- Multi-Strategy Support (later) — lazım olsa Zustand həmin hissədə.
- "Close all & stop" fövqəladə düyməsi (later) — bütün mövqeləri bağlayıb dayandırır.

## 3. Tech stack

| Qat | Texnologiya |
|---|---|
| Frontend | React 18 + Vite + TypeScript |
| Server state | TanStack Query + socket.io-client |
| Client state | useState + lift; kiçik Context |
| HTTP | axios (`lib/http.ts`, response interceptor) |
| i18n | react-i18next (en/az/tr.json) |
| Charts | Recharts |
| Styling | Tailwind CSS (mockup tokenləri) |
| Backend | Mövcud Node.js/TS prosesinə Express read-only API + socket.io |
| Storage | Mövcud v1 formatı + storage-adapter |
| Deploy | pm2 + Express-dən static serve |

## 4. Folder structure

```
traiderim/
├── src/                        # v1 backend (dəyişmir)
│   ├── data/  indicators/  signals/  risk/  execution/  reporting/
│   └── server/                 # YENİ
│       ├── api/                # Express read-only routes
│       ├── ws/                 # socket.io server + emit nöqtələri
│       └── storage-adapter/    # mövcud formatı oxuyan qat
├── shared/
│   └── types.ts                # Trade, Position, Signal, EquityPoint, SystemHealth
├── dashboard/
│   ├── src/
│   │   ├── lib/http.ts         # axios instance + interceptor
│   │   ├── features/           # trades/, portfolio/, signals/, health/
│   │   ├── components/         # StatCard, RegimeStrip, DataTable, Footer, BottomNav...
│   │   ├── pages/              # Overview, Trades, Signals, Performance, Health
│   │   ├── hooks/              # useSocket
│   │   ├── locales/            # en.json, az.json, tr.json
│   │   └── theme/              # design tokens
│   └── index.html
├── CLAUDE.md
└── package.json                # npm workspaces
```

## 5. Data schema (API səviyyəsi)

| Obyekt | Sahə | Tip | Qeyd |
|---|---|---|---|
| Position | id | string | unikal |
| Position | symbol | string | məs. BTCUSDT |
| Position | side | "long"\|"short" | istiqamət |
| Position | entryPrice, size | number | giriş, ATR ölçü |
| Position | stopLoss, takeProfit | number | risk səviyyələri |
| Position | openedAt | number | ms epoch |
| Position | unrealizedPnl | number | canlı |
| Trade | Position + exitPrice, closedAt, realizedPnl | — | bağlanmış |
| Trade | ruleCode | string | deterministik kod |
| Trade | exitReason | string | stop/target/signal |
| Signal | symbol, timeframe, type | string | 4H/1H |
| Signal | createdAt | number | ms epoch |
| EquityPoint | timestamp, equity | number | əyri nöqtəsi |
| SystemHealth | schedulerStatus | "running"\|"stalled" | |
| SystemHealth | engineState | "running"\|"paused" | pause-entries flag-i |
| SystemHealth | stateChangedAt | number | son start/stop vaxtı (ms epoch) |
| SystemHealth | lastFetchAt, recentErrors | number, array | |
| EngineStateLog | state, changedAt, reason | string, number, string | hər start/stop qeydi; pauza günləri paper günü sayılmır |

## 6. API

Cavab forması hər yerdə: `{ data, error }`. GET endpoint-lər read-only; iki POST control endpoint-i `X-Control-Token` header-i tələb edir.

### REST
| Method | Path | Məqsəd |
|---|---|---|
| GET | /api/portfolio | Equity, P&L, mövqe sayı |
| GET | /api/positions | Açıq mövqelər |
| GET | /api/trades?limit=&symbol= | Bağlanmış treydlər |
| GET | /api/signals?limit= | Son siqnallar |
| GET | /api/equity-curve?from=&to= | Equity nöqtələri |
| GET | /api/metrics | Win rate, DD, PF, go-live |
| GET | /api/health | Sistem statusu |
| POST | /api/engine/start | Pause flag-ini söndürür — yeni girişlər aktivləşir (token tələb edir) |
| POST | /api/engine/stop | Pause entries — yeni girişlər dayanır, açıq mövqelər idarə olunur (token tələb edir) |

### socket.io (server → client)
| Hadisə | Payload | Nə vaxt |
|---|---|---|
| portfolio:update | xülasə | hər qiymət dövrəsi |
| position:update | Position[] | P&L dəyişəndə |
| trade:closed | Trade | bağlananda |
| signal:new | Signal | yeni siqnal |
| health:update | SystemHealth | dövrə/xəta |
| engine:state | { engineState, stateChangedAt } | Start/Stop basılanda — bütün açıq client-lər dərhal görür |

## 7. Features

### 1. Portfolio Overview (2 gün)
- Backend: `GET /api/portfolio`; `portfolio:update` emit.
- Frontend: `OverviewPage` (4 StatCard), `usePortfolio` (REST+socket), P&L rəng kodlaması.

### 2. Open Positions & Trade History (2 gün)
- Backend: `GET /api/positions`, `GET /api/trades` (filtrli); `position:update`, `trade:closed` emit.
- Frontend: `PositionsTable` (canlı P&L), `TradesTable` (filtrlər), closed-trade animasiyası.

### 3. Signal Monitor (2 gün)
- Backend: `GET /api/signals`; `signal:new` emit.
- Frontend: `RegimeStrip` (imza), `RegimeGrid`, `SignalFeed` (pulse).

### 4. Performance & Go-Live (2 gün)
- Backend: `GET /api/equity-curve`, `GET /api/metrics`.
- Frontend: `EquityCurveChart` (DD vurğusu), `MetricsPanel`, `GoLiveProgress` (3 bar).

### 5. System Health (1 gün)
- Backend: `GET /api/health`; `health:update` emit.
- Frontend: `HealthPage`, `ConnectionBadge`.

### 6. i18n + chrome (1 gün)
- Frontend: react-i18next (3 locale), `Footer`, `BottomNav` (≤820px).

### 7. Engine Control (1 gün)
- Backend: `POST /api/engine/start|stop` — token yoxlaması, ExecutionEngine-də pause flag (yeni giriş bloklanır, mövqe idarəsi davam edir), `EngineStateLog` qeydi, `engine:state` emit.
- Frontend: `EngineToggle` — header-də ConnectionBadge yanında, `running/paused` vəziyyəti rənglə (yaşıl/amber); `ConfirmDialog` — hər iki istiqamətdə təsdiq, təsadüfi toxunuşa qarşı; Health səhifəsində state log siyahısı.

### 8. Telegram Bridge (2 gün)
- Backend (`src/server/telegram/`): grammY ilə bot modulu, eyni prosesin içində.
  - Bildirişlər: `trade:closed` (P&L ilə), `signal:new`, `engine:state`, kritik xətalar — socket emit nöqtələri ilə eyni yerdən çağırılır.
  - Əmrlər: `/status` (portfolio xülasəsi), `/trades` (son 5 treyd), `/stop`, `/start` (engine control funksiyaları — eyni pause semantikası, `EngineStateLog`-a "manual (telegram)" qeydi).
  - Təhlükəsizlik: yalnız `ALLOWED_CHAT_IDS` (env) əmr verə bilər; bot token env-də.
- Frontend: tələb yoxdur.

## 8. Build plan

| № | Mərhələ | Nə ediləcək | Əlaqə | Müddət |
|---|---|---|---|---|
| 1 | Repo v2 restrukturu | 1. `git branch v1` + push (v1 daimi qalır)<br>2. `v2` branch — bütün iş burada<br>3. npm workspaces qurulumu<br>4. `shared/types.ts` — 5 interfeys mövcud koddan çıxarılır<br>5. Vite + React + TS + Tailwind scaffold<br>6. Yoxlama: `npm run dev` hər iki tərəfdə | İnfrastruktur | 1 gün |
| 2 | Storage adapter + REST + control | 1. Mövcud saxlama formatının yoxlanması, `storage-adapter/` yazılması<br>2. 7 read-only GET endpoint<br>3. `POST /api/engine/start\|stop` — `X-Control-Token` yoxlaması (env-dən), ExecutionEngine-də pause flag, `EngineStateLog` qeydi<br>4. `{ data, error }` forması, düzgün status kodları (401 yanlış token üçün)<br>5. Yoxlama: curl ilə real data + stop→start dövrəsində yeni girişin bloklanıb açılması | F1-5+7 backend (REST) | 2.5 gün |
| 3 | socket.io qatı | 1. `src/server/ws/` — Express-ə bağlanır<br>2. Emit nöqtələri: scheduler, ExecutionEngine, SignalEngine + `engine:state`<br>3. Reconnect-də son vəziyyət<br>4. Yoxlama: test client ilə canlı hadisələr | F1-5+7 backend (canlı) | 2 gün |
| 4 | Frontend scaffold + dizayn + i18n + control | 1. Tailwind theme (mockup tokenləri)<br>2. `lib/http.ts` — axios + interceptor (token header daxil)<br>3. TanStack Query + `useSocket` (setQueryData)<br>4. Layout: sidebar, BottomNav, RegimeStrip, ConnectionBadge, Footer<br>5. `EngineToggle` + `ConfirmDialog` — header-də, `engine:state` ilə sinxron<br>6. react-i18next — 3 locale (control mətnləri daxil)<br>7. Yoxlama: routing, dil keçidi, socket statusu, toggle dövrəsi | İnfrastruktur + F6+7 | 3.5 gün |
| 5 | Overview + Positions/Trades | 1. `OverviewPage` — mock → REST+socket<br>2. `PositionsTable` — canlı P&L<br>3. `TradesTable` — filtrlər<br>4. Closed-trade animasiyası<br>5. Yoxlama: canlı data ekranda | F1+2 frontend | 2 gün |
| 6 | Performance | 1. `EquityCurveChart`<br>2. `MetricsPanel`<br>3. `GoLiveProgress`<br>4. Yoxlama: tarixi data render | F4 frontend | 2 gün |
| 7 | Signals + Health | 1. `RegimeGrid` + canlı RegimeStrip<br>2. `SignalFeed`<br>3. `HealthPage`<br>4. Yoxlama: siqnal real vaxtda | F3+5 frontend | 2 gün |
| 8 | Polish + test + merge + deploy | 1. Loading/empty/error state-ləri, disconnect banneri<br>2. Responsive test (375/768/1024/1440) × 3 dil<br>3. `vite build` + static serve + pm2<br>4. Testlər uğurlu → `v2` → `main` merge + push<br>5. Yoxlama: pm2 restart sonrası production işləyir | İnfrastruktur | 2 gün |

| 9 | Telegram Bridge | 1. @BotFather ilə bot yaradılması, token + `ALLOWED_CHAT_IDS` env-ə<br>2. `src/server/telegram/` — grammY modulu, bildirişlərin emit nöqtələrinə qoşulması<br>3. Əmrlər: `/status`, `/trades`, `/stop`, `/start` — chat ID yoxlaması ilə<br>4. Yoxlama: treyd bağlananda mesaj gəlir; `/stop` dashboard-da pauza kimi görünür və logda "manual (telegram)" qeydi var | Feature 8 | 2 gün |

**Ümumi: ~19 gün** (solo developer, gündə ~3-4 saat)
