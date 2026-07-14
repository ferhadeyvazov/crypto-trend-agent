import express, { type Application, type Request, type Response, type NextFunction } from "express";
import { DataService, type DataServiceDeps } from "./dataService.js";
import { fail } from "./respond.js";
import { portfolioRouter } from "./routes/portfolio.js";
import { positionsRouter } from "./routes/positions.js";
import { tradesRouter } from "./routes/trades.js";
import { signalsRouter } from "./routes/signals.js";
import { equityCurveRouter } from "./routes/equityCurve.js";
import { metricsRouter } from "./routes/metrics.js";
import { healthRouter } from "./routes/health.js";
import { engineControlRouter } from "./routes/engineControl.js";

// ===================================================================
// Dashboard read-only REST API (plan bölmə 6). Eyni Node prosesində,
// `main.ts`-in `for(;;)` icra loop-u ilə paralel işləyir — ayrıca
// proses/IPC YOXDUR, `executionEngine`-ə birbaşa referens verilir.
// ===================================================================

export interface ApiApp {
  app: Application;
  dataService: DataService;
}

export function createApiApp(deps: DataServiceDeps): ApiApp {
  const dataService = new DataService(deps);
  const app = express();
  app.use(express.json());

  app.use("/api/portfolio", portfolioRouter(dataService));
  app.use("/api/positions", positionsRouter(dataService));
  app.use("/api/trades", tradesRouter(dataService));
  app.use("/api/signals", signalsRouter(dataService));
  app.use("/api/equity-curve", equityCurveRouter(dataService));
  app.use("/api/metrics", metricsRouter(dataService));
  app.use("/api/health", healthRouter(dataService));
  app.use("/api/engine", engineControlRouter(dataService));

  app.use((_req: Request, res: Response) => {
    fail(res, 404, "Endpoint tapılmadı");
  });

  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    fail(res, 500, err instanceof Error ? err.message : "Naməlum server xətası");
  });

  return { app, dataService };
}
