// ===================================================================
// Express query-param parsing köməkçiləri — bütün route-lar eyni
// yoxlama məntiqini bölüşür (limit/from/to müsbət ədəd olmalıdır).
// ===================================================================

/** `undefined` = param verilməyib; `"invalid"` = verilib amma yanlış; `number` = uğurlu. */
export function parseOptionalLimit(value: unknown): number | "invalid" | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== "string") return "invalid";
  const n = Number(value);
  if (!Number.isInteger(n) || n < 0) return "invalid";
  return n;
}

/** ms epoch gözlənilən query param (`from`/`to`). */
export function parseOptionalTimestamp(value: unknown): number | "invalid" | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== "string") return "invalid";
  const n = Number(value);
  if (!Number.isFinite(n)) return "invalid";
  return n;
}
