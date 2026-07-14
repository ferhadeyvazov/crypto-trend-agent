import { Router } from "express";
import type { DataService } from "../dataService.js";
import { ok, fail } from "../respond.js";
import { parseOptionalLimit } from "../queryParsing.js";

export function tradesRouter(dataService: DataService): Router {
  const router = Router();
  router.get("/", async (req, res) => {
    const limit = parseOptionalLimit(req.query.limit);
    if (limit === "invalid") {
      fail(res, 400, "limit müsbət tam ədəd olmalıdır");
      return;
    }
    const symbol = typeof req.query.symbol === "string" ? req.query.symbol : undefined;
    const trades = await dataService.getTrades({ limit, symbol });
    ok(res, trades);
  });
  return router;
}
