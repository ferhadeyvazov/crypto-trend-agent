# CLAUDE.md — Crypto Trend Agent

## Layihə nədir

"Crypto Trend-Following Trading System v1.0" spesifikasiyasının (`docs/crypto-trend-spec.pdf`)
TypeScript/Node.js implementasiyası. Dual-timeframe trend-following sistem: 4h rejim filtri +
1h icra. Rejim: **PAPER_TRADING** — real pul YOXDUR və istifadəçinin açıq təsdiqi olmadan
heç vaxt LIVE-ə keçilə bilməz (spec, bölmə 11).

**İstifadəçi haqqında:** Farhad — developer (TypeScript/React/Node/Java), amma trading-də
yenidir. İzahları sadə dildə ver, trading terminlərini ilk istifadədə açıqla. Azərbaycan
dilində cavab ver; kod identifikatorları və şərhlərdəki texniki adlar ingiliscə qalır.

## Dəyişilməz qaydalar (bunları HEÇ VAXT pozma)

1. **Source of truth:** bütün strategiya parametrləri `src/config/strategy.v1.json`-dadır.
   Kodda hardcode parametr QADAĞANDIR.
2. **Overfitting qadağası (spec §11):** strategiya parametrlərini (ADX həddi, ATR
   multiplikatorları və s.) nəticələr pis olduğu üçün "optimallaşdırmaq" QADAĞANDIR.
   Dəyişiklik yalnız: istifadəçinin açıq təsdiqi + konkret hipotez + versiya artımı (v1.1)
   + sıfırdan yeni 60 günlük paper test ilə mümkündür. İstifadəçi "qazandırana kimi
   dəyişək" desə belə, bu intizamı xatırlat.
3. **Yalnız bağlanmış şamlar:** siqnallar heç vaxt bağlanmamış (formalaşan) şamla
   hesablanmır. `DataLayer.getClosedCandles` bunu dizaynla təmin edir — bu zəmanəti
   pozan kod yazma.
4. **Şübhə → dayan:** qayda tətbiqində qeyri-müəyyənlik yaranarsa: pozisiya açma,
   logla, istifadəçiyə bildir (spec §13, `onUncertainty`).
5. **Konservativ simulyasiya:** eyni barda həm stop, həm TP dəyibsə — STOP birinci
   sayılır (spec §10.3). Xərcsiz simulyasiya ETİBARSIZDIR — fee + slippage həmişə tətbiq olunur.
6. Hər mərhələ testlə gəlir: `npx tsc --noEmit` təmiz + `npm test` yaşıl olmadan
   mərhələ bitmiş sayılmır.

## Konvensiyalar

- İndikatorlar: çıxış massivi girişlə eyni uzunluqda, indekslər üst-üstə düşür,
  isinmə (warm-up) dövrü = `NaN`. `NaN` görən kod siqnal hesablamır.
- RSI/ATR/ADX: Wilder hamarlaması (spec §3.1). EMA: SMA seed.
- EMA200 üçün minimum ~1000 şam tarixçə istifadə et (seed təsirinin sönməsi üçün).
- Dependency injection: `fetch`, `now()` kimi asılılıqlar konstruktordan verilir —
  testlərdə saxtalaşdırıla bilsin.
- Test üslubu: (a) əl ilə hesablanmış kiçik nümunələr, (b) riyazi xassələr
  ("qalxan bazarda RSI=100"), (c) müstəqil referansla cross-check.
- API açarları yalnız `.env`-də (`.gitignore`-dadır). Çata/kommitə açar salmaq qadağandır.

## Əmrlər

- `npm test` — bütün testlər (hazırda 42)
- `npx tsc --noEmit` — tip yoxlaması
- `npm run smoke` — DataLayer-in real Binance ilə işlədiyini yoxlayır (trade etmir)
- `npm run validate` — TradingView müqayisəsi üçün indikator dəyərlərini çap edir (spec §3.1: ±0.5%)

## Yol xəritəsi və status

| Mərhələ | Nə | Status |
|---|---|---|
| 1 | DataLayer (Binance fetch, closed-candle zəmanəti, gap→karantin, keş) | ✅ smoke test istifadəçidə uğurlu |
| 2 | İndikatorlar (EMA, RSI, ATR, ADX, MACD, Donchian) + 3 qatlı validasiya | ✅ kod hazır; ⚠️ TradingView əl yoxlaması istifadəçi tərəfindən hələ TƏSDİQLƏNMƏYİB — Mərhələ 3-dən əvvəl tamamla |
| 3 | SignalEngine: 4h rejim (R4.1–R4.3), 1h girişlər (5.1 Pullback A, 5.2 Breakout B), filtrlər F1–F5 | ⬜ növbəti |
| 4 | RiskManager: sizing (§7), portfel limitləri (§8), gündəlik/həftəlik limitlər, BTC regime guard | ⬜ |
| 5 | ExecutionEngine (paper): fill simulyasiyası (§10.3), fee+slippage modeli (§10.2), trade journal (§10.4), state machine (§9) | ⬜ |
| 6 | Reporting: metrikalar (§11), həftəlik hesabat, go-live kriteriya yoxlaması | ⬜ |
| — | 60 gün + min 100 trade paper trading; nəticələrin analizi | ⬜ |

## İş üslubu

- Bir mərhələ = tam bitmiş iş: kod + testlər + sadə dildə izah. Mərhələni bitirəndə
  dayan, nəticəni göstər, istifadəçinin təsdiqini gözlə.
- Mərhələdən kənara çıxma ("bir az da növbəti mərhələdən edim" — yox).
- Spesifikasiya ilə kod arasında ziddiyyət görsən: spec qalib gəlir; ziddiyyəti
  istifadəçiyə göstər.
- Layihənin məqsədi strategiyanı "qazandırmaq" deyil, onun haqqında HƏQİQƏTİ
  ölçməkdir. Bu çərçivəni qoru.
