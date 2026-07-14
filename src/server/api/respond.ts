import type { Response } from "express";

// ===================================================================
// Plan bölmə 6: "Cavab forması hər yerdə: { data, error }".
// ===================================================================

export function ok<T>(res: Response, data: T, status = 200): void {
  res.status(status).json({ data, error: null });
}

export function fail(res: Response, status: number, message: string): void {
  res.status(status).json({ data: null, error: { message } });
}
