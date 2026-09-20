import "dotenv/config";
import { bot, configureBotProfile } from "../src/bot";

/**
 * Разовая настройка после деплоя на Vercel: сообщает Telegram, куда слать
 * обновления, и регистрирует меню команд. Запуск: `npm run webhook:set`.
 *
 * Нужны переменные окружения:
 *   WEBHOOK_URL              — https://<project>.vercel.app/api/webhook
 *   TELEGRAM_WEBHOOK_SECRET  — тот же секрет, что задан в env на Vercel (опционально, но рекомендуется)
 */

async function main(): Promise<void> {
  const url = process.env.WEBHOOK_URL;
  if (!url) {
    throw new Error("Укажите WEBHOOK_URL, напр. https://ваш-проект.vercel.app/api/webhook");
  }

  const secretToken = process.env.TELEGRAM_WEBHOOK_SECRET || undefined;

  await bot.api.setWebhook(url, secretToken ? { secret_token: secretToken } : undefined);
  console.log("✅ Webhook установлен:", url);

  await configureBotProfile();
  console.log("✅ Меню команд настроено.");

  const info = await bot.api.getWebhookInfo();
  console.log("Webhook info:", {
    url: info.url,
    pending_update_count: info.pending_update_count,
    last_error_message: info.last_error_message,
  });
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("❌ Не удалось настроить вебхук:", err);
    process.exit(1);
  });
