import { Router } from "express";
import type { DataService } from "../dataService.js";
import { ok } from "../respond.js";

export function metricsRouter(dataService: DataService): Router {
  const router = Router();
  router.get("/", async (_req, res) => {
    ok(res, await dataService.getMetrics());
  });
  return router;
}
