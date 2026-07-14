import { EventEmitter } from "node:events";
import type { PortfolioSummary, Position, Trade, Signal, SystemHealth } from "../../shared/types.js";

// ===================================================================
// `DataService` (Express qatı) və `ws/` (socket.io qatı) arasında
// birbaşa asılılıq olmasın deyə — REST tərəfi bu bus-a yazır, socket.io
// tərəfi dinləyib `io.emit(...)`-ə çevirir (plan bölmə 6, 6 hadisə).
// Node-un daxili EventEmitter-i üzərində tipli nazik sarğı.
// ===================================================================

export interface ServerEventMap {
  "portfolio:update": PortfolioSummary;
  "position:update": Position[];
  "trade:closed": Trade;
  "signal:new": Signal;
  "health:update": SystemHealth;
  "engine:state": { engineState: "running" | "paused"; stateChangedAt: number };
}

export type ServerEvents = EventEmitter;

export function createServerEvents(): ServerEvents {
  return new EventEmitter();
}

export function emitServerEvent<K extends keyof ServerEventMap>(
  bus: ServerEvents,
  event: K,
  payload: ServerEventMap[K],
): void {
  bus.emit(event, payload);
}

export function onServerEvent<K extends keyof ServerEventMap>(
  bus: ServerEvents,
  event: K,
  handler: (payload: ServerEventMap[K]) => void,
): void {
  bus.on(event, handler);
}
