import type { DataService } from "../api/dataService.js";
import {
  formatStatusMessage,
  formatTradesMessage,
  formatEngineStateNotification,
} from "./formatters.js";

// ===================================================================
// `/status`, `/trades`, `/stop`, `/start` üçün əmr məntiqi (Mərhələ 9).
// grammY `Context`-dən asılı deyil — `bot.ts` bunları çağırıb nəticəni
// `ctx.reply(...)`-ə ötürür. Parametr tipləri `DataService`-in yalnız
// istifadə olunan metodlarını tələb edir (`Pick`) — testlərdə tam
// `DataService` qurmadan sadə fake obyektlə çağırıla bilsin.
// ===================================================================

const TELEGRAM_REASON = "manual (telegram)";

export async function buildStatusReply(dataService: Pick<DataService, "getPortfolio" | "getHealth">): Promise<string> {
  return formatStatusMessage(dataService.getPortfolio(), dataService.getHealth());
}

export async function buildTradesReply(dataService: Pick<DataService, "getTrades">): Promise<string> {
  const trades = await dataService.getTrades({ limit: 5 });
  return formatTradesMessage(trades);
}

export async function buildStopReply(dataService: Pick<DataService, "stopEngine">): Promise<string> {
  const health = dataService.stopEngine(TELEGRAM_REASON);
  return formatEngineStateNotification({ engineState: health.engineState, stateChangedAt: health.stateChangedAt });
}

export async function buildStartReply(dataService: Pick<DataService, "startEngine">): Promise<string> {
  const health = dataService.startEngine(TELEGRAM_REASON);
  return formatEngineStateNotification({ engineState: health.engineState, stateChangedAt: health.stateChangedAt });
}
