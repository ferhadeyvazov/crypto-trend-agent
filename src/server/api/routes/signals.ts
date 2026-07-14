import { Router } from "express";
import type { DataService } from "../dataService.js";
import { ok, fail } from "../respond.js";
import { parseOptionalLimit } from "../queryParsing.js";

export function signalsRouter(dataService: DataService): Router {
  const router = Router();
  router.get("/", async (req, res) => {
    const limit = parseOptionalLimit(req.query.limit);
    if (limit === "invalid") {
      fail(res, 400, "limit müsbət tam ədəd olmalıdır");
      return;
    }
    const signals = await dataService.getSignals({ limit });
    ok(res, signals);
  });
  return router;
}
