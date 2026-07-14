import type { Request, Response, NextFunction } from "express";
import { fail } from "../respond.js";

// ===================================================================
// Plan bölmə 6: yazma (control) endpoint-ləri `X-Control-Token`
// header-i tələb edir. Token `.env`-dəki CONTROL_TOKEN-dır.
// ===================================================================

export function requireControlToken(req: Request, res: Response, next: NextFunction): void {
  const expected = process.env.CONTROL_TOKEN;
  if (!expected) {
    fail(res, 500, "CONTROL_TOKEN env dəyişəni server tərəfində konfiqurasiya olunmayıb");
    return;
  }
  const provided = req.header("X-Control-Token");
  if (provided !== expected) {
    fail(res, 401, "Yanlış və ya çatışmayan X-Control-Token");
    return;
  }
  next();
}
