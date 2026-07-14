// ===================================================================
// Vahid query-key toplusu — həm `hooks/useSocket.ts` (setQueryData/
// invalidateQueries), həm gələcək mərhələlərin `useQuery` çağırışları
// EYNİ açarları istifadə etsin deyə (açarlar uyuşmasa socket-dən gələn
// yeniləmə səhv cache girişinə yazılar).
// ===================================================================

export const queryKeys = {
  portfolio: ["portfolio"] as const,
  positions: ["positions"] as const,
  trades: (params: { limit?: number; symbol?: string } = {}) => ["trades", params] as const,
  signals: (params: { limit?: number } = {}) => ["signals", params] as const,
  equityCurve: (params: { from?: number; to?: number } = {}) => ["equityCurve", params] as const,
  metrics: ["metrics"] as const,
  health: ["health"] as const,
};
