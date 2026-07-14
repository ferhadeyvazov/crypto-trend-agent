import type { PortfolioSummary, SystemHealth, Trade, Signal } from "../../../shared/types.js";

// ===================================================================
// Telegram mesaj mətnləri (Mərhələ 9). Xalis funksiyalar — grammY-ə,
// şəbəkəyə və ya hər hansı I/O-ya asılı deyil, ona görə vitest ilə
// birbaşa test olunur (bax tests/telegram.test.ts).
// Azərbaycan dilində (layihənin loglama dili ilə tutarlı) — texniki
// terminlər (P&L, LONG/SHORT, rule code) tərcümə olunmur.
// ===================================================================

function fmtUsd(n: number): string {
  return `${n >= 0 ? "+" : ""}${n.toFixed(2)} USD`;
}

function fmtPct(n: number): string {
  return `${n >= 0 ? "+" : ""}${n.toFixed(2)}%`;
}

export function formatStatusMessage(portfolio: PortfolioSummary, health: SystemHealth): string {
  return [
    `📊 Status`,
    `Equity: ${portfolio.equity.toFixed(2)} USD (${fmtPct(portfolio.allTimePnlPct)})`,
    `Bu günkü P&L: ${fmtUsd(portfolio.dailyPnlUsd)} (${fmtPct(portfolio.dailyPnlPct)})`,
    `Açıq mövqe: ${portfolio.openPositionCount}`,
    `Risk məruzəsi: ${(portfolio.openRiskPct * 100).toFixed(2)}%`,
    `Engine: ${health.engineState === "running" ? "işləyir ✅" : "pauzada ⏸️"}`,
    `Scheduler: ${health.schedulerStatus === "running" ? "işləyir ✅" : "dayanıb ⚠️"}`,
  ].join("\n");
}

export function formatTradesMessage(trades: Trade[]): string {
  if (trades.length === 0) return "📜 Hələ bağlanmış treyd yoxdur.";
  const lines = trades.map((t) => {
    const date = new Date(t.closedAt).toISOString().slice(0, 16).replace("T", " ");
    return `${t.symbol} ${t.side.toUpperCase()} · ${fmtUsd(t.realizedPnl)} · ${t.exitReason} · ${date}`;
  });
  return [`📜 Son ${trades.length} treyd:`, ...lines].join("\n");
}

export function formatTradeClosedNotification(trade: Trade): string {
  const emoji = trade.realizedPnl >= 0 ? "✅" : "🔴";
  return [
    `${emoji} Treyd bağlandı: ${trade.symbol} ${trade.side.toUpperCase()}`,
    `Nəticə: ${fmtUsd(trade.realizedPnl)}`,
    `Səbəb: ${trade.exitReason}`,
    `Giriş: ${trade.entryPrice} → Çıxış: ${trade.exitPrice}`,
  ].join("\n");
}

export function formatSignalNotification(signal: Signal): string {
  return `📡 Yeni siqnal: ${signal.symbol} (${signal.timeframe}) — ${signal.type}`;
}

export function formatEngineStateNotification(state: { engineState: "running" | "paused"; stateChangedAt: number }): string {
  return state.engineState === "paused"
    ? "⏸️ Engine PAUZAYA alındı — yeni girişlər dayandırıldı, açıq mövqelər idarə olunmağa davam edir."
    : "▶️ Engine BƏRPA edildi — yeni girişlər aktivdir.";
}

export function formatCriticalErrorNotification(message: string): string {
  return `⚠️ Kritik xəta: ${message}`;
}
