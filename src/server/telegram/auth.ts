// ===================================================================
// Chat-id icazə yoxlaması (Mərhələ 9). `ALLOWED_CHAT_IDS` env dəyişəni
// vergüllə ayrılmış chat ID siyahısıdır. Boş/təyin olunmayıbsa —
// default-DENY (heç bir əmr icazəli deyil), allow-all YOXDUR.
// ===================================================================

export function parseAllowedChatIds(env: string | undefined): Set<number> {
  if (!env) return new Set();
  return new Set(
    env
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s.length > 0)
      .map(Number)
      .filter((n) => Number.isFinite(n)),
  );
}

export function isAllowedChatId(chatId: number, allowed: Set<number>): boolean {
  return allowed.has(chatId);
}
