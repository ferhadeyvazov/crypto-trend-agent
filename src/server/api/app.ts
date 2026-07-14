import express, { type Application, type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { DataService, type DataServiceDeps } from "./dataService.js";
import { fail } from "./respond.js";
import { portfolioRouter } from "./routes/portfolio.js";
import { positionsRouter } from "./routes/positions.js";
import { tradesRouter } from "./routes/trades.js";
import { signalsRouter } from "./routes/signals.js";
import { equityCurveRouter } from "./routes/equityCurve.js";
import { metricsRouter } from "./routes/metrics.js";
import { healthRouter } from "./routes/health.js";
import { regimesRouter } from "./routes/regimes.js";
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
  // Dashboard dev-server (Vite, fərqli port) → API cross-origin sorğu edir (Mərhələ 4).
  app.use(cors({ origin: process.env.DASHBOARD_ORIGIN ?? "http://localhost:5173" }));
  app.use(express.json());

  app.use("/api/portfolio", portfolioRouter(dataService));
  app.use("/api/positions", positionsRouter(dataService));
  app.use("/api/trades", tradesRouter(dataService));
  app.use("/api/signals", signalsRouter(dataService));
  app.use("/api/equity-curve", equityCurveRouter(dataService));
  app.use("/api/metrics", metricsRouter(dataService));
  app.use("/api/health", healthRouter(dataService));
  app.use("/api/regimes", regimesRouter(dataService));
  app.use("/api/engine", engineControlRouter(dataService));

  // Production static serve (plan bölmə 3, "Deploy: pm2 + Express-dən static serve").
  // `dashboard/dist` YALNIZ `npm run build` (dashboard) icra olunandan sonra mövcuddur —
  // dev axınında (Vite dev server, ayrıca port) bu blok sadəcə aktivləşmir, TƏSİR ETMİR.
  const dashboardDist = fileURLToPath(new URL("../../../dashboard/dist", import.meta.url));
  if (existsSync(dashboardDist)) {
    app.use(express.static(dashboardDist));
    app.get(/^(?!\/api).*/, (_req: Request, res: Response) => {
      res.sendFile(fileURLToPath(new URL("../../../dashboard/dist/index.html", import.meta.url)));
    });
  }

  app.use((_req: Request, res: Response) => {
    fail(res, 404, "Endpoint tapılmadı");
  });

  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    fail(res, 500, err instanceof Error ? err.message : "Naməlum server xətası");
  });

  return { app, dataService };
}
