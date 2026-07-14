import { type ServerEvents, onServerEvent } from "../serverEvents.js";
import {
  formatTradeClosedNotification,
  formatSignalNotification,
  formatEngineStateNotification,
  formatCriticalErrorNotification,
} from "./formatters.js";

// ===================================================================
// `serverEvents` bus-unu dinləyib icazəli bütün chat-lərə bildiriş
// göndərir (Mərhələ 9). `sendMessage` inject edilir (real grammY
// `bot.api.sendMessage` və ya testdə fake funksiya) — bu modul grammY-ə
// birbaşa asılı deyil.
// ===================================================================

export interface TelegramNotifierDeps {
  serverEvents: ServerEvents;
  allowedChatIds: Set<number>;
  sendMessage: (chatId: number, text: string) => Promise<unknown> | void;
}

export function createTelegramNotifier(deps: TelegramNotifierDeps): void {
  const broadcast = (text: string): void => {
    for (const chatId of deps.allowedChatIds) {
      try {
        Promise.resolve(deps.sendMessage(chatId, text)).catch(() => {});
      } catch {
        // Göndərmə xətası bütün prosesi dayandırmamalıdır — sükutla keç.
      }
    }
  };

  onServerEvent(deps.serverEvents, "trade:closed", (trade) => broadcast(formatTradeClosedNotification(trade)));
  onServerEvent(deps.serverEvents, "signal:new", (signal) => broadcast(formatSignalNotification(signal)));
  onServerEvent(deps.serverEvents, "engine:state", (state) => broadcast(formatEngineStateNotification(state)));
  onServerEvent(deps.serverEvents, "error:critical", ({ message }) => broadcast(formatCriticalErrorNotification(message)));
}
