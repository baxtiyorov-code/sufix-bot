/**
 * Список администраторов бота из переменных окружения.
 *
 *   ADMIN_CHAT_ID    — один или несколько Telegram user ID через запятую
 *   ADMIN_USERNAMES  — один или несколько username через запятую (без @, регистр не важен)
 *
 * Полный доступ администратора: команда /stats и безлимитные проверки файлов
 * (дневной лимит и токены не расходуются).
 */

const adminIds = new Set(
  (process.env.ADMIN_CHAT_ID ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean)
);

const adminUsernames = new Set(
  (process.env.ADMIN_USERNAMES ?? "")
    .split(",")
    .map((value) => value.trim().replace(/^@/, "").toLowerCase())
    .filter(Boolean)
);

export function isAdmin(userId: number | undefined, username?: string | null): boolean {
  if (userId !== undefined && adminIds.has(String(userId))) return true;
  if (username && adminUsernames.has(username.toLowerCase())) return true;
  return false;
}
