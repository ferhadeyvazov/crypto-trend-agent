import { Router } from "express";
import type { DataService } from "../dataService.js";
import { ok } from "../respond.js";

export function healthRouter(dataService: DataService): Router {
  const router = Router();
  router.get("/", (_req, res) => {
    ok(res, dataService.getHealth());
  });
  return router;
}
