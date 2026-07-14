import { http } from "../lib/http.ts";
import type {
  PortfolioSummary,
  Position,
  Trade,
  Signal,
  EquityPoint,
  SystemHealth,
  MetricsResponse,
  RegimeSnapshot,
} from "@shared/types.ts";

// ===================================================================
// api-client qatı (plan: "Component → hook → api-client → lib/http.ts").
// Komponentlər birbaşa axios/http çağırmır, yalnız bu funksiyaları
// (adətən bir hook-un içindən, TanStack Query ilə) istifadə edir.
// ===================================================================

export async function getPortfolio(): Promise<PortfolioSummary> {
  return (await http.get<PortfolioSummary>("/api/portfolio")).data;
}

export async function getPositions(): Promise<Position[]> {
  return (await http.get<Position[]>("/api/positions")).data;
}

export async function getTrades(params: { limit?: number; symbol?: string } = {}): Promise<Trade[]> {
  return (await http.get<Trade[]>("/api/trades", { params })).data;
}

export async function getSignals(params: { limit?: number } = {}): Promise<Signal[]> {
  return (await http.get<Signal[]>("/api/signals", { params })).data;
}

export async function getEquityCurve(params: { from?: number; to?: number } = {}): Promise<EquityPoint[]> {
  return (await http.get<EquityPoint[]>("/api/equity-curve", { params })).data;
}

export async function getMetrics(): Promise<MetricsResponse> {
  return (await http.get<MetricsResponse>("/api/metrics")).data;
}

export async function getHealth(): Promise<SystemHealth> {
  return (await http.get<SystemHealth>("/api/health")).data;
}

export async function getRegimes(): Promise<RegimeSnapshot[]> {
  return (await http.get<RegimeSnapshot[]>("/api/regimes")).data;
}

/** Yazma endpoint-ləri — `X-Control-Token` YALNIZ burada, birbaşa çağırışın header-ində (plan qərarı). */
function controlHeaders(): Record<string, string> {
  const token = import.meta.env.VITE_CONTROL_TOKEN;
  return token ? { "X-Control-Token": token } : {};
}

export async function startEngine(reason: string): Promise<SystemHealth> {
  return (await http.post<SystemHealth>("/api/engine/start", { reason }, { headers: controlHeaders() })).data;
}

export async function stopEngine(reason: string): Promise<SystemHealth> {
  return (await http.post<SystemHealth>("/api/engine/stop", { reason }, { headers: controlHeaders() })).data;
}
