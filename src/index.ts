import { bot, configureBotProfile } from "./bot";

/**
 * Точка входа для локальной разработки / ручного деплоя на VPS — long polling.
 * Для serverless-хостинга (Vercel) используется вебхук: [api/webhook.ts](../api/webhook.ts).
 */

configureBotProfile().catch((err) => console.error("Не удалось настроить меню бота:", err));

bot.start();
console.log("Бот запущен (long polling).");
