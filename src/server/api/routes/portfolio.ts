import { Router } from "express";
import type { DataService } from "../dataService.js";
import { ok } from "../respond.js";

export function portfolioRouter(dataService: DataService): Router {
  const router = Router();
  router.get("/", (_req, res) => {
    ok(res, dataService.getPortfolio());
  });
  return router;
}
