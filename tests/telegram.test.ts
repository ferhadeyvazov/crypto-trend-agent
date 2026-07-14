import { describe, it, expect, vi } from "vitest";
import { parseAllowedChatIds, isAllowedChatId } from "../src/server/telegram/auth.js";
import {
  formatStatusMessage,
  formatTradesMessage,
  formatTradeClosedNotification,
  formatSignalNotification,
  formatEngineStateNotification,
  formatCriticalErrorNotification,
} from "../src/server/telegram/formatters.js";
import { buildStatusReply, buildTradesReply, buildStopReply, buildStartReply } from "../src/server/telegram/commands.js";
import { createTelegramNotifier } from "../src/server/telegram/notifier.js";
import { createServerEvents, emitServerEvent } from "../src/server/serverEvents.js";
import { HealthTracker } from "../src/health/HealthTracker.js";
import type { PortfolioSummary, SystemHealth, Trade } from "../../shared/types.js";

// ===================================================================
// Mərhələ 9 — Telegram Bridge. Real grammY/Telegram şəbəkəsi İSTİFADƏ
// OLUNMUR (bot tokeni tələb edərdi) — auth/formatters/commands/notifier
// xalis funksiyalardır və ya inject edilmiş fake `sendMessage`/
// `DataService` metodları ilə test olunur.
// ===================================================================

const samplePortfolio: PortfolioSummary = {
  equity: 10500,
  dailyPnlPct: 1.2,
  dailyPnlUsd: 125,
  weeklyPnlPct: 3.4,
  openPositionCount: 2,
  openRiskPct: 0.015,
  allTimePnlPct: 5,
};

const sampleHealth: SystemHealth = {
  schedulerStatus: "running",
  engineState: "running",
  stateChangedAt: 1000,
  lastFetchAt: 2000,
  recentErrors: [],
  stateLog: [],
  recentEvents: [],
};

const sampleTrade: Trade = {
  id: "t1",
  symbol: "BTCUSDT",
  side: "long",
  entryPrice: 65000,
  size: 0.1,
  stopLoss: 64000,
  takeProfit: 67000,
  openedAt: 1000,
  exitPrice: 66000,
  closedAt: 2000,
  realizedPnl: 95.5,
  ruleCode: "PULLBACK_X3_TRAILING_STOP",
  exitReason: "X3_TRAILING_STOP",
};

describe("auth.ts", () => {
  it("parseAllowedChatIds vergüllə ayrılmış siyahını Set-ə çevirir", () => {
    expect(parseAllowedChatIds("111, 222,333")).toEqual(new Set([111, 222, 333]));
  });

  it("parseAllowedChatIds undefined/boş üçün boş Set qaytarır (default-deny)", () => {
    expect(parseAllowedChatIds(undefined)).toEqual(new Set());
    expect(parseAllowedChatIds("")).toEqual(new Set());
  });

  it("parseAllowedChatIds rəqəm olmayan girişləri atır", () => {
    expect(parseAllowedChatIds("111,abc,222")).toEqual(new Set([111, 222]));
  });

  it("isAllowedChatId icazəli/icazəsiz chat-i düzgün ayırır", () => {
    const allowed = new Set([111, 222]);
    expect(isAllowedChatId(111, allowed)).toBe(true);
    expect(isAllowedChatId(999, allowed)).toBe(false);
  });
});

describe("formatters.ts", () => {
  it("formatStatusMessage əsas göstəriciləri daxil edir", () => {
    const text = formatStatusMessage(samplePortfolio, sampleHealth);
    expect(text).toContain("10500.00");
    expect(text).toContain("Açıq mövqe: 2");
    expect(text).toContain("işləyir");
  });

  it("formatTradesMessage boş siyahı üçün mesaj göstərir", () => {
    expect(formatTradesMessage([])).toContain("yoxdur");
  });

  it("formatTradesMessage treydləri sətir-sətir formatlaşdırır", () => {
    const text = formatTradesMessage([sampleTrade]);
    expect(text).toContain("BTCUSDT");
    expect(text).toContain("LONG");
    expect(text).toContain("+95.50 USD");
  });

  it("formatTradeClosedNotification qazanc/zərəri fərqləndirir", () => {
    expect(formatTradeClosedNotification(sampleTrade)).toContain("✅");
    expect(formatTradeClosedNotification({ ...sampleTrade, realizedPnl: -10 })).toContain("🔴");
  });

  it("formatSignalNotification simvol/timeframe/tipi göstərir", () => {
    const text = formatSignalNotification({ symbol: "ETHUSDT", timeframe: "4H", type: "TREND_UP", createdAt: 1 });
    expect(text).toContain("ETHUSDT");
    expect(text).toContain("4H");
    expect(text).toContain("TREND_UP");
  });

  it("formatEngineStateNotification running/paused üçün fərqli mətn qaytarır", () => {
    expect(formatEngineStateNotification({ engineState: "paused", stateChangedAt: 1 })).toContain("PAUZAYA");
    expect(formatEngineStateNotification({ engineState: "running", stateChangedAt: 1 })).toContain("BƏRPA");
  });

  it("formatCriticalErrorNotification mesajı daxil edir", () => {
    expect(formatCriticalErrorNotification("Binance timeout")).toContain("Binance timeout");
  });
});

describe("commands.ts", () => {
  it("buildStatusReply DataService-dən portfolio+health çağırır", async () => {
    const fake = { getPortfolio: () => samplePortfolio, getHealth: () => sampleHealth };
    const text = await buildStatusReply(fake);
    expect(text).toContain("Açıq mövqe: 2");
  });

  it("buildTradesReply limit=5 ilə getTrades çağırır", async () => {
    const getTrades = vi.fn().mockResolvedValue([sampleTrade]);
    const text = await buildTradesReply({ getTrades });
    expect(getTrades).toHaveBeenCalledWith({ limit: 5 });
    expect(text).toContain("BTCUSDT");
  });

  it("buildStopReply 'manual (telegram)' səbəbi ilə stopEngine çağırır", async () => {
    const stopEngine = vi.fn().mockReturnValue({ ...sampleHealth, engineState: "paused", stateChangedAt: 5 });
    const text = await buildStopReply({ stopEngine });
    expect(stopEngine).toHaveBeenCalledWith("manual (telegram)");
    expect(text).toContain("PAUZAYA");
  });

  it("buildStartReply 'manual (telegram)' səbəbi ilə startEngine çağırır", async () => {
    const startEngine = vi.fn().mockReturnValue({ ...sampleHealth, engineState: "running", stateChangedAt: 5 });
    const text = await buildStartReply({ startEngine });
    expect(startEngine).toHaveBeenCalledWith("manual (telegram)");
    expect(text).toContain("BƏRPA");
  });
});

describe("notifier.ts", () => {
  it("trade:closed hadisəsində bütün icazəli chat-lərə mesaj göndərir", () => {
    const serverEvents = createServerEvents();
    const sent: Array<{ chatId: number; text: string }> = [];
    createTelegramNotifier({
      serverEvents,
      allowedChatIds: new Set([111, 222]),
      sendMessage: (chatId, text) => {
        sent.push({ chatId, text });
      },
    });

    emitServerEvent(serverEvents, "trade:closed", sampleTrade);

    expect(sent).toHaveLength(2);
    expect(sent.map((s) => s.chatId).sort()).toEqual([111, 222]);
    expect(sent[0].text).toContain("BTCUSDT");
  });

  it("sendMessage rədd olunsa belə digər chat-lərə göndərməyə davam edir", async () => {
    const serverEvents = createServerEvents();
    const sent: number[] = [];
    createTelegramNotifier({
      serverEvents,
      allowedChatIds: new Set([111, 222]),
      sendMessage: (chatId) => {
        if (chatId === 111) return Promise.reject(new Error("network"));
        sent.push(chatId);
      },
    });

    emitServerEvent(serverEvents, "engine:state", { engineState: "paused", stateChangedAt: 1 });
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(sent).toEqual([222]);
  });

  it("error:critical hadisəsində formatlanmış mesaj göndərir", () => {
    const serverEvents = createServerEvents();
    const sent: string[] = [];
    createTelegramNotifier({
      serverEvents,
      allowedChatIds: new Set([111]),
      sendMessage: (_chatId, text) => {
        sent.push(text);
      },
    });

    emitServerEvent(serverEvents, "error:critical", { message: "Universe yenilənmədi", ts: 1 });

    expect(sent[0]).toContain("Universe yenilənmədi");
  });
});

describe("HealthTracker — onCriticalError", () => {
  it("error() çağırılanda onCriticalError callback-i mesajla işə düşür", () => {
    const received: string[] = [];
    const healthTracker = new HealthTracker(
      { log() {}, trade() {}, signal() {}, risk() {}, warn() {}, error() {} },
      { now: () => 1000, onCriticalError: (message) => received.push(message) },
    );

    healthTracker.error("Binance şəbəkə xətası");

    expect(received).toEqual(["Binance şəbəkə xətası"]);
  });

  it("onCriticalError verilməyibsə error() yenə də normal işləyir", () => {
    const healthTracker = new HealthTracker(
      { log() {}, trade() {}, signal() {}, risk() {}, warn() {}, error() {} },
      { now: () => 1000 },
    );

    expect(() => healthTracker.error("xəta")).not.toThrow();
  });
});
