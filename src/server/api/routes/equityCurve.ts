import { Router } from "express";
import type { DataService } from "../dataService.js";
import { ok, fail } from "../respond.js";
import { parseOptionalTimestamp } from "../queryParsing.js";

export function equityCurveRouter(dataService: DataService): Router {
  const router = Router();
  router.get("/", async (req, res) => {
    const from = parseOptionalTimestamp(req.query.from);
    const to = parseOptionalTimestamp(req.query.to);
    if (from === "invalid" || to === "invalid") {
      fail(res, 400, "from/to ms epoch olmalıdır");
      return;
    }
    const curve = await dataService.getEquityCurve({ from, to });
    ok(res, curve);
  });
  return router;
}
