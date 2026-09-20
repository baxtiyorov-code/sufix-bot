import type { VercelRequest, VercelResponse } from "@vercel/node";
import { webhookCallback } from "grammy";
import { bot } from "../src/bot";

/**
 * Точка входа для Vercel: Telegram стучится сюда POST-запросом при каждом
 * обновлении (сообщение, нажатие кнопки, платёж и т.д.). Long polling здесь
 * не используется — см. [src/index.ts](../src/index.ts) для локального запуска.
 *
 * После настройки установите сам вебхук командой `npm run webhook:set`
 * (см. scripts/set-webhook.ts).
 */

const secretToken = process.env.TELEGRAM_WEBHOOK_SECRET || undefined;

const handleUpdate = webhookCallback(bot, "next-js", { secretToken });

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    res.status(200).send("sufix-bot webhook: OK");
    return;
  }

  try {
    await handleUpdate(req, res);
  } catch (error) {
    console.error("Ошибка обработки вебхука:", error);
    if (!res.headersSent) {
      res.status(200).end(); // Telegram не должен ретраить из-за наших внутренних ошибок
    }
  }
}
