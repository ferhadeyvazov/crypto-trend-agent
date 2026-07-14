import { Router } from "express";
import type { DataService } from "../dataService.js";
import { ok } from "../respond.js";

export function positionsRouter(dataService: DataService): Router {
  const router = Router();
  router.get("/", (_req, res) => {
    ok(res, dataService.getPositions());
  });
  return router;
}
