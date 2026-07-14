import { Bot } from "grammy";
import type { DataService } from "../api/dataService.js";
import type { ServerEvents } from "../serverEvents.js";
import type { Logger } from "../../logging/index.js";
import { parseAllowedChatIds, isAllowedChatId } from "./auth.js";
import { buildStatusReply, buildTradesReply, buildStopReply, buildStartReply } from "./commands.js";
import { createTelegramNotifier } from "./notifier.js";

// ===================================================================
// grammY-i yuxarıdakı xalis modullara (auth/commands/notifier) bağlayan
// nazik "glue" qatı (Mərhələ 9). `TELEGRAM_BOT_TOKEN` yoxdursa bridge
// tamamilə deaktiv qalır (dev-safe guard — Stage 8-in `existsSync`
// naxışı ilə eyni fəlsəfə): proses çökmür, sadəcə xəbərdarlıq logu.
// ===================================================================

export interface TelegramBridgeDeps {
  token: string | undefined;
  allowedChatIdsEnv: string | undefined;
  dataService: DataService;
  serverEvents: ServerEvents;
  logger: Logger;
}

const NOT_ALLOWED_REPLY = "Bu bot yalnız icazəli istifadəçilər üçündür.";

export function createTelegramBridge(deps: TelegramBridgeDeps): void {
  if (!deps.token) {
    deps.logger.warn("Telegram bridge deaktivdir (TELEGRAM_BOT_TOKEN yoxdur)");
    return;
  }

  const allowedChatIds = parseAllowedChatIds(deps.allowedChatIdsEnv);
  if (allowedChatIds.size === 0) {
    deps.logger.warn("Telegram bridge: ALLOWED_CHAT_IDS boşdur — bütün əmrlər rədd ediləcək");
  }

  const bot = new Bot(deps.token);

  bot.use(async (ctx, next) => {
    const chatId = ctx.chat?.id;
    if (chatId === undefined || !isAllowedChatId(chatId, allowedChatIds)) {
      await ctx.reply(NOT_ALLOWED_REPLY);
      return;
    }
    await next();
  });

  bot.command("status", async (ctx) => ctx.reply(await buildStatusReply(deps.dataService)));
  bot.command("trades", async (ctx) => ctx.reply(await buildTradesReply(deps.dataService)));
  bot.command("stop", async (ctx) => ctx.reply(await buildStopReply(deps.dataService)));
  bot.command("start", async (ctx) => ctx.reply(await buildStartReply(deps.dataService)));

  bot.catch((err) => {
    deps.logger.error("Telegram bot xətası", { error: String(err) });
  });

  createTelegramNotifier({
    serverEvents: deps.serverEvents,
    allowedChatIds,
    sendMessage: (chatId, text) => bot.api.sendMessage(chatId, text),
  });

  bot.start().catch((err) => {
    deps.logger.error("Telegram bot başlaya bilmədi", { error: String(err) });
  });
}
