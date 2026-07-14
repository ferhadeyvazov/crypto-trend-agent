import { Router } from "express";
import type { DataService } from "../dataService.js";
import { ok } from "../respond.js";
import { requireControlToken } from "../middleware/controlToken.js";

const DEFAULT_REASON = "manual (dashboard)";

export function engineControlRouter(dataService: DataService): Router {
  const router = Router();

  router.post("/start", requireControlToken, (req, res) => {
    const reason = typeof req.body?.reason === "string" ? req.body.reason : DEFAULT_REASON;
    ok(res, dataService.startEngine(reason));
  });

  router.post("/stop", requireControlToken, (req, res) => {
    const reason = typeof req.body?.reason === "string" ? req.body.reason : DEFAULT_REASON;
    ok(res, dataService.stopEngine(reason));
  });

  return router;
}
