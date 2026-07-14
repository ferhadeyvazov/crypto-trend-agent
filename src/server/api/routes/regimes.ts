import { Router } from "express";
import type { DataService } from "../dataService.js";
import { ok } from "../respond.js";

export function regimesRouter(dataService: DataService): Router {
  const router = Router();
  router.get("/", (_req, res) => {
    ok(res, dataService.getRegimes());
  });
  return router;
}
