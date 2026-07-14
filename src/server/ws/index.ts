import type { Server as HttpServer } from "node:http";
import { Server as SocketIOServer } from "socket.io";
import type { DataService } from "../api/dataService.js";
import { type ServerEvents, onServerEvent } from "../serverEvents.js";

// ===================================================================
// Dashboard socket.io qatı (plan bölmə 6, 8). Eyni `http.Server`-ə
// (Express-in `app.listen()`-i qaytardığı) bağlanır — ayrıca port YOXDUR.
// `serverEvents` bus-unu dinləyib `io.emit(...)`-ə çevirir; yeni
// qoşulan client-ə isə "son vəziyyət" snapshot-ları göndərir.
// ===================================================================

export function createSocketServer(
  httpServer: HttpServer,
  dataService: DataService,
  serverEvents: ServerEvents,
): SocketIOServer {
  const io = new SocketIOServer(httpServer, {
    cors: { origin: process.env.DASHBOARD_ORIGIN ?? "http://localhost:5173" },
  });

  io.on("connection", (socket) => {
    // Reconnect-də son vəziyyət (plan bölmə 8, Mərhələ 3) — YALNIZ bu socket-ə.
    socket.emit("portfolio:update", dataService.getPortfolio());
    socket.emit("position:update", dataService.getPositions());
    socket.emit("health:update", dataService.getHealth());
  });

  onServerEvent(serverEvents, "portfolio:update", (payload) => io.emit("portfolio:update", payload));
  onServerEvent(serverEvents, "position:update", (payload) => io.emit("position:update", payload));
  onServerEvent(serverEvents, "trade:closed", (payload) => io.emit("trade:closed", payload));
  onServerEvent(serverEvents, "signal:new", (payload) => io.emit("signal:new", payload));
  onServerEvent(serverEvents, "health:update", (payload) => io.emit("health:update", payload));
  onServerEvent(serverEvents, "engine:state", (payload) => io.emit("engine:state", payload));

  return io;
}
