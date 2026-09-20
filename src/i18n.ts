export type Lang = "ru" | "en" | "uz";

export const LANGUAGE_NAMES: Record<Lang, string> = {
  ru: "Русский",
  en: "English",
  uz: "O'zbekcha",
};

/**
 * ─── Визуальная система сообщений ────────────────────────────────
 * Единый язык оформления для всех экранов бота:
 *
 *   • Заголовок экрана     — иконка + <b>НАЗВАНИЕ</b>
 *   • Ключевая мысль        — в <blockquote> сразу под заголовком
 *   • Пары «поле → значение» — «Подпись: <b>значение</b>»
 *   • Разделы внутри экрана — через пустую строку, без линий-«артефактов»
 *   • Иконки — сдержанный набор, один смысл = одна иконка:
 *       🛡 бренд · 📄 файл · 👤 профиль · 💳 баланс · 🗂 история
 *       🌐 язык · 💡 помощь · ⏳ ожидание · 🟢🟡🔴 вердикт
 */

export const BRAND = "GUARDIX";

/** Выбирает нужную форму русского слова по числу: 1 ссылка / 2 ссылки / 5 ссылок. */
function pluralRu(n: number, one: string, few: string, many: string): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return few;
  return many;
}

export type VerdictKind = "clean" | "suspicious" | "malicious";

interface ScanResultParams {
  kind: VerdictKind;
  fileName: string; // уже экранирован
  fileType: string; // "PDF" | "APK" | urlTypeLabel
  fileSize: string; // "2.41 MB", для ссылок — ""
  detected: number;
  total: number;
  meter: string; // визуальная шкала детектов
  fromCache: boolean;
  /** Результат Google Safe Browsing — только для ссылок, если ключ настроен. */
  safeBrowsing?: "clean" | "threat";
}

interface MenuCommand {
  command: string;
  description: string;
}

interface Translations {
  // ─── Главный экран / меню ───
  heroTagline: string;
  heroBody: (maxSizeMb: number) => string;
  menuBalanceLabel: string;
  menuBalanceValue: (free: number, limit: number, paid: number) => string;

  // ─── Кнопки навигации ───
  navProfile: string;
  navHistory: string;
  navBalance: string;
  navLanguage: string;
  navHelp: string;
  navMenu: string;
  navBuy: string;
  navRetry: string;

  // ─── Экраны ───
  help: string;
  languagePrompt: string;
  languageSaved: (lang: string) => string;

  historyTitle: string;
  historyRow: (emoji: string, typeIcon: string, name: string, date: string) => string;
  historyEmpty: string;
  historyEmptyHint: string;

  statsDenied: string;
  statsTitle: (params: {
    total: number;
    clean: number;
    suspicious: number;
    malicious: number;
    users: number;
  }) => string;

  profile: (params: {
    name: string;
    username: string | null;
    userId: number;
    language: string;
    memberSince: string;
    total: number;
    clean: number;
    suspicious: number;
    malicious: number;
    isAdmin: boolean;
    freeRemaining: number;
    dailyLimit: number;
    paidTokens: number;
    resetIn: string;
  }) => string;

  balanceMessage: (
    freeRemaining: number,
    dailyLimit: number,
    paidTokens: number,
    resetIn: string
  ) => string;

  // ─── Токены / оплата ───
  tokenWord: string;
  buyTitle: string;
  invoiceTitle: string;
  invoiceDescription: (tokens: number) => string;
  invoiceLabel: (tokens: number) => string;
  paymentSuccess: (tokens: number) => string;
  limitReached: (dailyLimit: number, resetIn: string) => string;

  // ─── Проверка файла и ссылок ───
  unsupportedExt: string;
  tooLarge: (sizeMb: string, maxMb: number) => string;
  scanningTitle: string;
  scanningTitleUrl: string;
  urlTypeLabel: string;
  /** В сообщении, кроме проверяемой, есть ещё N ссылок. */
  multipleLinksNotice: (extraCount: number) => string;
  /** Сообщение содержит больше ссылок, чем разрешено проверять за раз. */
  tooManyLinks: (found: number, max: number) => string;
  steps: {
    download: string;
    search: string;
    analyze: string;
  };
  scanResult: (params: ScanResultParams) => string;
  error: string;
  nonDocument: string;

  /** Оставшееся время до сброса лимита, напр. «5 ч 30 мин». */
  resetTimer: (hours: number, minutes: number) => string;

  /** Пункты нативного меню команд Telegram. */
  menuCommands: MenuCommand[];
}

// ────────────────────────────────────────────────────────────────
// RU
// ────────────────────────────────────────────────────────────────

const URL_LABEL_RU = "Ссылка";

const ru: Translations = {
  heroTagline: "Проверка файлов и ссылок через 70+ антивирусных движков",
  heroBody: (maxSizeMb) =>
    "<blockquote>Отправьте файл (как <b>документ</b>) или ссылку — проверю " +
    "примерно 70 антивирусными движками и пришлю вердикт.</blockquote>\n\n" +
    `📎 Файлы: <b>PDF</b>, <b>APK</b>   ·   до <b>${maxSizeMb} МБ</b>\n` +
    "🔗 Ссылки: любой адрес вида http:// или https://",
  menuBalanceLabel: "Баланс",
  menuBalanceValue: (free, limit, paid) =>
    `${free}/${limit} бесплатных сегодня · ${paid} токенов`,

  navProfile: "👤 Профиль",
  navHistory: "🗂 История",
  navBalance: "💳 Баланс",
  navLanguage: "🌐 Язык",
  navHelp: "💡 Помощь",
  navMenu: "‹ Меню",
  navBuy: "Купить токены",
  navRetry: "Отправить другой файл",

  help:
    "💡 <b>КАК ЭТО РАБОТАЕТ</b>\n\n" +
    "<blockquote>Файл или ссылка проверяются примерно 70 антивирусами одновременно. " +
    "Если их уже проверяли раньше — ответ придёт мгновенно.</blockquote>\n\n" +
    "<b>1.</b> Отправьте <b>.pdf</b>/<b>.apk</b> как документ, или пришлите ссылку (http/https)\n" +
    "<b>2.</b> Дождитесь результата — от пары секунд до минуты\n" +
    "<b>3.</b> Получите вердикт и ссылку на подробный отчёт\n\n" +
    "Бесплатно — 3 проверки в сутки. Больше — за токены.",

  languagePrompt: "🌐 <b>ЯЗЫК ИНТЕРФЕЙСА</b>\n\n<blockquote>Выберите язык — он сохранится для всех сообщений бота.</blockquote>",
  languageSaved: (lang) => `🌐 Язык интерфейса: <b>${lang}</b>`,

  historyTitle:
    "🗂 <b>ПОСЛЕДНИЕ ПРОВЕРКИ</b>\n\n" +
    "<blockquote>Пять недавних файлов. Полный архив — в вашем профиле.</blockquote>",
  historyRow: (emoji, typeIcon, name, date) => `${emoji} ${typeIcon} <b>${name}</b>\n<i>${date}</i>`,
  historyEmpty: "🗂 <b>ИСТОРИЯ ПУСТА</b>",
  historyEmptyHint:
    "<blockquote>Здесь появятся ваши проверки. Отправьте первый PDF или APK файл в чат.</blockquote>",

  statsDenied: "⛔ Раздел доступен только администратору бота.",
  statsTitle: ({ total, clean, suspicious, malicious, users }) =>
    "📊 <b>СТАТИСТИКА БОТА</b>\n\n" +
    `Проверок всего: <b>${total}</b>\n` +
    `🟢 Чистых: <b>${clean}</b>\n` +
    `🟡 Подозрительных: <b>${suspicious}</b>\n` +
    `🔴 Опасных: <b>${malicious}</b>\n\n` +
    `👥 Уникальных пользователей: <b>${users}</b>`,

  profile: ({ name, username, userId, language, memberSince, total, clean, suspicious, malicious, isAdmin, freeRemaining, dailyLimit, paidTokens, resetIn }) =>
    "👤 <b>ПРОФИЛЬ</b>\n\n" +
    (isAdmin ? "<blockquote>👑 Администратор бота</blockquote>\n\n" : "") +
    `Имя: <b>${name}</b>\n` +
    (username ? `Ник: @${username}\n` : "") +
    `ID: <code>${userId}</code>\n` +
    `Язык: <b>${language}</b>\n` +
    `С нами с: <b>${memberSince}</b>\n\n` +
    "💳 <b>Баланс</b>\n" +
    (isAdmin
      ? "♾ <b>Безлимит</b> — проверки без ограничений\n\n"
      : `Бесплатные сегодня: <b>${freeRemaining}/${dailyLimit}</b>   ·   ⏳ сброс через <b>${resetIn}</b>\n` +
        `Токены: <b>${paidTokens}</b>\n\n`) +
    "📊 <b>Проверки</b>\n" +
    `Всего: <b>${total}</b>\n` +
    `🟢 ${clean}   ·   🟡 ${suspicious}   ·   🔴 ${malicious}`,

  balanceMessage: (freeRemaining, dailyLimit, paidTokens, resetIn) =>
    "💳 <b>БАЛАНС</b>\n\n" +
    "<blockquote>Сначала расходуются бесплатные проверки, затем токены. " +
    "Токен не сгорает и не имеет срока действия.</blockquote>\n\n" +
    `Бесплатные сегодня: <b>${freeRemaining}/${dailyLimit}</b>\n` +
    `⏳ Сброс лимита через: <b>${resetIn}</b>\n` +
    `Токены: <b>${paidTokens}</b>`,

  tokenWord: "токенов",
  buyTitle:
    "💳 <b>ПОКУПКА ТОКЕНОВ</b>\n\n" +
    "<blockquote>1 токен = 1 проверка файла сверх дневного лимита. " +
    "Оплата в Telegram Stars.</blockquote>",
  invoiceTitle: "Токены для проверки файлов",
  invoiceDescription: (tokens) => `${tokens} токенов на проверку PDF и APK файлов сверх дневного лимита.`,
  invoiceLabel: (tokens) => `${tokens} токенов`,
  paymentSuccess: (tokens) =>
    "🟢 <b>ОПЛАТА ПРОШЛА</b>\n\n" + `Начислено <b>${tokens}</b> токенов. Можно проверять файлы без ожидания.`,
  limitReached: (dailyLimit, resetIn) =>
    "⏳ <b>ДНЕВНОЙ ЛИМИТ ИСЧЕРПАН</b>\n\n" +
    `<blockquote>Использованы все ${dailyLimit} бесплатных проверки на сегодня.</blockquote>\n\n` +
    `Лимит обновится через <b>${resetIn}</b> — либо купите токены и продолжайте сейчас.`,

  unsupportedExt:
    "📄 <b>ФОРМАТ НЕ ПОДДЕРЖИВАЕТСЯ</b>\n\n" +
    "<blockquote>Проверяю только <b>PDF</b> и <b>APK</b>. Отправьте файл в одном из этих форматов как документ.</blockquote>",
  tooLarge: (sizeMb, maxMb) =>
    "📄 <b>ФАЙЛ СЛИШКОМ БОЛЬШОЙ</b>\n\n" +
    `<blockquote>Размер файла — <b>${sizeMb} МБ</b>, а лимит на проверку — <b>${maxMb} МБ</b>.</blockquote>`,
  scanningTitle: "⏳ <b>ПРОВЕРЯЮ ФАЙЛ</b>",
  scanningTitleUrl: "⏳ <b>ПРОВЕРЯЮ ССЫЛКУ</b>",
  urlTypeLabel: URL_LABEL_RU,
  multipleLinksNotice: (extraCount) =>
    `ℹ️ В сообщении есть ещё ${extraCount} ${pluralRu(extraCount, "ссылка", "ссылки", "ссылок")} — ` +
    "проверяю первую. Чтобы проверить остальные, отправьте их отдельными сообщениями.",
  tooManyLinks: (found, max) =>
    "📄 <b>СЛИШКОМ МНОГО ССЫЛОК</b>\n\n" +
    `<blockquote>В сообщении ${found} ссылок, а за раз проверяю не больше ${max}. ` +
    "Отправьте ссылки по одной или небольшими группами.</blockquote>",
  steps: {
    download: "Загружаю файл из Telegram",
    search: "Ищу в базе данных",
    analyze: "Сканирую ~70 антивирусами",
  },
  scanResult: ({ kind, fileName, fileType, fileSize, detected, total, meter, fromCache, safeBrowsing }) => {
    const isUrl = fileType === URL_LABEL_RU;
    const icon = isUrl ? "🔗" : "📄";
    const badge = kind === "malicious" ? "🔴" : kind === "suspicious" ? "🟡" : "🟢";
    const title =
      kind === "malicious"
        ? "ОПАСНО"
        : kind === "suspicious"
        ? "ПОДОЗРИТЕЛЬНО"
        : isUrl
        ? "ССЫЛКА БЕЗОПАСНА"
        : "ФАЙЛ ЧИСТ";
    const summary =
      kind === "malicious"
        ? isUrl
          ? `<b>${detected}</b> из ${total} антивирусов считают эту ссылку вредоносной. Не переходите по ней.`
          : `<b>${detected}</b> из ${total} антивирусов определили файл как вредоносный. Не открывайте и не устанавливайте его.`
        : kind === "suspicious"
        ? isUrl
          ? `<b>${detected}</b> из ${total} антивирусов считают эту ссылку подозрительной. Будьте осторожны.`
          : `<b>${detected}</b> из ${total} антивирусов сочли файл подозрительным. Отнеситесь с осторожностью.`
        : isUrl
        ? `Проверено ${total} антивирусами — угроз не обнаружено.`
        : `Проверено ${total} антивирусами — угроз не обнаружено.`;
    return (
      `${badge} <b>${title}</b>\n\n` +
      `<blockquote>${summary}</blockquote>\n\n` +
      `${icon} <b>${fileName}</b>\n` +
      `${fileType}` + (fileSize ? `   ·   ${fileSize}` : "") + `\n\n` +
      `Детекты: <b>${detected} / ${total}</b>\n` +
      `<code>${meter}</code>` +
      (safeBrowsing
        ? `\n🔎 Google Safe Browsing: <b>${safeBrowsing === "threat" ? "обнаружена угроза" : "чисто"}</b>`
        : "") +
      (fromCache ? "\n\n<i>💾 Результат из базы — уже проверяли ранее.</i>" : "")
    );
  },
  error:
    "🔴 <b>НЕ УДАЛОСЬ ПРОВЕРИТЬ</b>\n\n" +
    "<blockquote>Что-то пошло не так при проверке или в сети. Попробуйте ещё раз через минуту.</blockquote>",
  nonDocument:
    "📄 <b>ОТПРАВЬТЕ ФАЙЛ ИЛИ ССЫЛКУ</b>\n\n" +
    "<blockquote>Пришлите PDF или APK <b>как документ</b> (скрепка → Файл), либо отправьте ссылку (http/https) — и я запущу проверку.</blockquote>",

  resetTimer: (hours, minutes) => (hours > 0 ? `${hours} ч ${minutes} мин` : `${minutes} мин`),

  menuCommands: [
    { command: "menu", description: "Главное меню" },
    { command: "profile", description: "Профиль и статистика" },
    { command: "balance", description: "Баланс и токены" },
    { command: "buy", description: "Купить токены" },
    { command: "history", description: "Последние проверки" },
    { command: "language", description: "Сменить язык" },
    { command: "help", description: "Как пользоваться ботом" },
  ],
};

// ────────────────────────────────────────────────────────────────
// EN
// ────────────────────────────────────────────────────────────────

const URL_LABEL_EN = "Link";

const en: Translations = {
  heroTagline: "Scan files and links with 70+ antivirus engines",
  heroBody: (maxSizeMb) =>
    "<blockquote>Send a file (as a <b>document</b>) or a link — I'll run it " +
    "through ~70 antivirus engines and return a verdict.</blockquote>\n\n" +
    `📎 Files: <b>PDF</b>, <b>APK</b>   ·   up to <b>${maxSizeMb} MB</b>\n` +
    "🔗 Links: any http:// or https:// address",
  menuBalanceLabel: "Balance",
  menuBalanceValue: (free, limit, paid) => `${free}/${limit} free today · ${paid} tokens`,

  navProfile: "👤 Profile",
  navHistory: "🗂 History",
  navBalance: "💳 Balance",
  navLanguage: "🌐 Language",
  navHelp: "💡 Help",
  navMenu: "‹ Menu",
  navBuy: "Buy tokens",
  navRetry: "Send another file",

  help:
    "💡 <b>HOW IT WORKS</b>\n\n" +
    "<blockquote>Your file or link is checked by ~70 antivirus engines at once. " +
    "If it was scanned before, the answer is instant.</blockquote>\n\n" +
    "<b>1.</b> Send a <b>.pdf</b>/<b>.apk</b> as a document, or send a link (http/https)\n" +
    "<b>2.</b> Wait for the result — a few seconds to a minute\n" +
    "<b>3.</b> Get a verdict and a detailed report\n\n" +
    "Free tier — 3 scans per day. More via tokens.",

  languagePrompt:
    "🌐 <b>INTERFACE LANGUAGE</b>\n\n<blockquote>Pick a language — it applies to every bot message.</blockquote>",
  languageSaved: (lang) => `🌐 Interface language: <b>${lang}</b>`,

  historyTitle:
    "🗂 <b>RECENT SCANS</b>\n\n" +
    "<blockquote>Your five most recent files. Full archive lives in your profile.</blockquote>",
  historyRow: (emoji, typeIcon, name, date) => `${emoji} ${typeIcon} <b>${name}</b>\n<i>${date}</i>`,
  historyEmpty: "🗂 <b>NO HISTORY YET</b>",
  historyEmptyHint:
    "<blockquote>Your scans will show up here. Send your first PDF or APK file to the chat.</blockquote>",

  statsDenied: "⛔ This section is available to the bot admin only.",
  statsTitle: ({ total, clean, suspicious, malicious, users }) =>
    "📊 <b>BOT STATISTICS</b>\n\n" +
    `Total scans: <b>${total}</b>\n` +
    `🟢 Clean: <b>${clean}</b>\n` +
    `🟡 Suspicious: <b>${suspicious}</b>\n` +
    `🔴 Malicious: <b>${malicious}</b>\n\n` +
    `👥 Unique users: <b>${users}</b>`,

  profile: ({ name, username, userId, language, memberSince, total, clean, suspicious, malicious, isAdmin, freeRemaining, dailyLimit, paidTokens, resetIn }) =>
    "👤 <b>PROFILE</b>\n\n" +
    (isAdmin ? "<blockquote>👑 Bot administrator</blockquote>\n\n" : "") +
    `Name: <b>${name}</b>\n` +
    (username ? `Username: @${username}\n` : "") +
    `ID: <code>${userId}</code>\n` +
    `Language: <b>${language}</b>\n` +
    `Member since: <b>${memberSince}</b>\n\n` +
    "💳 <b>Balance</b>\n" +
    (isAdmin
      ? "♾ <b>Unlimited</b> — no scan limits\n\n"
      : `Free today: <b>${freeRemaining}/${dailyLimit}</b>   ·   ⏳ resets in <b>${resetIn}</b>\n` +
        `Tokens: <b>${paidTokens}</b>\n\n`) +
    "📊 <b>Scans</b>\n" +
    `Total: <b>${total}</b>\n` +
    `🟢 ${clean}   ·   🟡 ${suspicious}   ·   🔴 ${malicious}`,

  balanceMessage: (freeRemaining, dailyLimit, paidTokens, resetIn) =>
    "💳 <b>BALANCE</b>\n\n" +
    "<blockquote>Free scans are spent first, then tokens. " +
    "Tokens never expire.</blockquote>\n\n" +
    `Free today: <b>${freeRemaining}/${dailyLimit}</b>\n` +
    `⏳ Limit resets in: <b>${resetIn}</b>\n` +
    `Tokens: <b>${paidTokens}</b>`,

  tokenWord: "tokens",
  buyTitle:
    "💳 <b>BUY TOKENS</b>\n\n" +
    "<blockquote>1 token = 1 file scan beyond the daily limit. " +
    "Paid with Telegram Stars.</blockquote>",
  invoiceTitle: "Tokens for file scanning",
  invoiceDescription: (tokens) => `${tokens} tokens for scanning PDF and APK files beyond the daily limit.`,
  invoiceLabel: (tokens) => `${tokens} tokens`,
  paymentSuccess: (tokens) =>
    "🟢 <b>PAYMENT COMPLETE</b>\n\n" + `<b>${tokens}</b> tokens added. You can scan files without waiting.`,
  limitReached: (dailyLimit, resetIn) =>
    "⏳ <b>DAILY LIMIT REACHED</b>\n\n" +
    `<blockquote>You've used all ${dailyLimit} free scans for today.</blockquote>\n\n` +
    `The limit resets in <b>${resetIn}</b> — or buy tokens and keep going now.`,

  unsupportedExt:
    "📄 <b>UNSUPPORTED FORMAT</b>\n\n" +
    "<blockquote>I only scan <b>PDF</b> and <b>APK</b>. Send a file in one of these formats as a document.</blockquote>",
  tooLarge: (sizeMb, maxMb) =>
    "📄 <b>FILE TOO LARGE</b>\n\n" +
    `<blockquote>The file is <b>${sizeMb} MB</b>, but the scan limit is <b>${maxMb} MB</b>.</blockquote>`,
  scanningTitle: "⏳ <b>SCANNING FILE</b>",
  scanningTitleUrl: "⏳ <b>SCANNING LINK</b>",
  urlTypeLabel: URL_LABEL_EN,
  multipleLinksNotice: (extraCount) =>
    `ℹ️ There ${extraCount === 1 ? "is" : "are"} ${extraCount} more link${extraCount === 1 ? "" : "s"} in this message — ` +
    "checking the first one. Send the rest as separate messages to check them too.",
  tooManyLinks: (found, max) =>
    "📄 <b>TOO MANY LINKS</b>\n\n" +
    `<blockquote>This message has ${found} links, but I can only check ${max} at a time. ` +
    "Send links one at a time or in smaller batches.</blockquote>",
  steps: {
    download: "Downloading file from Telegram",
    search: "Looking it up in the database",
    analyze: "Scanning with ~70 engines",
  },
  scanResult: ({ kind, fileName, fileType, fileSize, detected, total, meter, fromCache, safeBrowsing }) => {
    const isUrl = fileType === URL_LABEL_EN;
    const icon = isUrl ? "🔗" : "📄";
    const badge = kind === "malicious" ? "🔴" : kind === "suspicious" ? "🟡" : "🟢";
    const title =
      kind === "malicious"
        ? "DANGEROUS"
        : kind === "suspicious"
        ? "SUSPICIOUS"
        : isUrl
        ? "LINK IS SAFE"
        : "FILE IS CLEAN";
    const summary =
      kind === "malicious"
        ? isUrl
          ? `<b>${detected}</b> of ${total} engines flagged this link as malicious. Don't open it.`
          : `<b>${detected}</b> of ${total} engines flagged this file as malicious. Do not open or install it.`
        : kind === "suspicious"
        ? isUrl
          ? `<b>${detected}</b> of ${total} engines flagged this link as suspicious. Proceed with caution.`
          : `<b>${detected}</b> of ${total} engines flagged this file as suspicious. Proceed with caution.`
        : `Scanned by ${total} engines — no threats found.`;
    return (
      `${badge} <b>${title}</b>\n\n` +
      `<blockquote>${summary}</blockquote>\n\n` +
      `${icon} <b>${fileName}</b>\n` +
      `${fileType}` + (fileSize ? `   ·   ${fileSize}` : "") + `\n\n` +
      `Detections: <b>${detected} / ${total}</b>\n` +
      `<code>${meter}</code>` +
      (safeBrowsing
        ? `\n🔎 Google Safe Browsing: <b>${safeBrowsing === "threat" ? "threat found" : "clean"}</b>`
        : "") +
      (fromCache ? "\n\n<i>💾 Result from our database — already scanned before.</i>" : "")
    );
  },
  error:
    "🔴 <b>SCAN FAILED</b>\n\n" +
    "<blockquote>Something went wrong during the scan or the network. Try again in a minute.</blockquote>",
  nonDocument:
    "📄 <b>SEND A FILE OR LINK</b>\n\n" +
    "<blockquote>Send a PDF or APK <b>as a document</b> (attach → File), or send a link (http/https) and I'll start the scan.</blockquote>",

  resetTimer: (hours, minutes) => (hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`),

  menuCommands: [
    { command: "menu", description: "Main menu" },
    { command: "profile", description: "Profile and stats" },
    { command: "balance", description: "Balance and tokens" },
    { command: "buy", description: "Buy tokens" },
    { command: "history", description: "Recent scans" },
    { command: "language", description: "Change language" },
    { command: "help", description: "How to use the bot" },
  ],
};

// ────────────────────────────────────────────────────────────────
// UZ
// ────────────────────────────────────────────────────────────────

const URL_LABEL_UZ = "Havola";

const uz: Translations = {
  heroTagline: "Fayllar va havolalarni 70+ antivirus dvigateli bilan tekshirish",
  heroBody: (maxSizeMb) =>
    "<blockquote>Faylni (<b>hujjat</b> sifatida) yoki havolani yuboring — ~70 ta " +
    "antivirus bilan tekshirib, xulosa qaytaraman.</blockquote>\n\n" +
    `📎 Fayllar: <b>PDF</b>, <b>APK</b>   ·   <b>${maxSizeMb} MB</b> gacha\n` +
    "🔗 Havolalar: http:// yoki https:// bilan boshlangan istalgan manzil",
  menuBalanceLabel: "Balans",
  menuBalanceValue: (free, limit, paid) => `bugun ${free}/${limit} bepul · ${paid} token`,

  navProfile: "👤 Profil",
  navHistory: "🗂 Tarix",
  navBalance: "💳 Balans",
  navLanguage: "🌐 Til",
  navHelp: "💡 Yordam",
  navMenu: "‹ Menyu",
  navBuy: "Token sotib olish",
  navRetry: "Boshqa fayl yuborish",

  help:
    "💡 <b>QANDAY ISHLAYDI</b>\n\n" +
    "<blockquote>Fayl yoki havola bir vaqtda ~70 ta antivirus bilan tekshiriladi. " +
    "Agar u avval tekshirilgan bo'lsa — javob darhol keladi.</blockquote>\n\n" +
    "<b>1.</b> <b>.pdf</b>/<b>.apk</b> ni hujjat sifatida yuboring, yoki havola (http/https) yuboring\n" +
    "<b>2.</b> Natijani kuting — bir necha soniyadan bir daqiqagacha\n" +
    "<b>3.</b> Xulosa va batafsil hisobotni oling\n\n" +
    "Bepul — kuniga 3 ta tekshiruv. Ko'proq — tokenlar orqali.",

  languagePrompt:
    "🌐 <b>INTERFEYS TILI</b>\n\n<blockquote>Tilni tanlang — u botning barcha xabarlariga qo'llaniladi.</blockquote>",
  languageSaved: (lang) => `🌐 Interfeys tili: <b>${lang}</b>`,

  historyTitle:
    "🗂 <b>OXIRGI TEKSHIRUVLAR</b>\n\n" +
    "<blockquote>Oxirgi beshta fayl. To'liq arxiv profilingizda.</blockquote>",
  historyRow: (emoji, typeIcon, name, date) => `${emoji} ${typeIcon} <b>${name}</b>\n<i>${date}</i>`,
  historyEmpty: "🗂 <b>TARIX BO'SH</b>",
  historyEmptyHint:
    "<blockquote>Tekshiruvlaringiz shu yerda ko'rinadi. Birinchi PDF yoki APK faylni chatga yuboring.</blockquote>",

  statsDenied: "⛔ Bu bo'lim faqat bot administratori uchun.",
  statsTitle: ({ total, clean, suspicious, malicious, users }) =>
    "📊 <b>BOT STATISTIKASI</b>\n\n" +
    `Jami tekshiruvlar: <b>${total}</b>\n` +
    `🟢 Toza: <b>${clean}</b>\n` +
    `🟡 Shubhali: <b>${suspicious}</b>\n` +
    `🔴 Xavfli: <b>${malicious}</b>\n\n` +
    `👥 Noyob foydalanuvchilar: <b>${users}</b>`,

  profile: ({ name, username, userId, language, memberSince, total, clean, suspicious, malicious, isAdmin, freeRemaining, dailyLimit, paidTokens, resetIn }) =>
    "👤 <b>PROFIL</b>\n\n" +
    (isAdmin ? "<blockquote>👑 Bot administratori</blockquote>\n\n" : "") +
    `Ism: <b>${name}</b>\n` +
    (username ? `Username: @${username}\n` : "") +
    `ID: <code>${userId}</code>\n` +
    `Til: <b>${language}</b>\n` +
    `Bizda: <b>${memberSince}</b> dan beri\n\n` +
    "💳 <b>Balans</b>\n" +
    (isAdmin
      ? "♾ <b>Cheksiz</b> — tekshiruvlar cheklovsiz\n\n"
      : `Bugun bepul: <b>${freeRemaining}/${dailyLimit}</b>   ·   ⏳ yangilanish <b>${resetIn}</b>\n` +
        `Tokenlar: <b>${paidTokens}</b>\n\n`) +
    "📊 <b>Tekshiruvlar</b>\n" +
    `Jami: <b>${total}</b>\n` +
    `🟢 ${clean}   ·   🟡 ${suspicious}   ·   🔴 ${malicious}`,

  balanceMessage: (freeRemaining, dailyLimit, paidTokens, resetIn) =>
    "💳 <b>BALANS</b>\n\n" +
    "<blockquote>Avval bepul tekshiruvlar, keyin tokenlar ishlatiladi. " +
    "Tokenlarning amal qilish muddati yo'q.</blockquote>\n\n" +
    `Bugun bepul: <b>${freeRemaining}/${dailyLimit}</b>\n` +
    `⏳ Limit yangilanishiga: <b>${resetIn}</b>\n` +
    `Tokenlar: <b>${paidTokens}</b>`,

  tokenWord: "token",
  buyTitle:
    "💳 <b>TOKEN SOTIB OLISH</b>\n\n" +
    "<blockquote>1 token = kunlik limitdan tashqari 1 ta fayl tekshiruvi. " +
    "To'lov Telegram Stars orqali.</blockquote>",
  invoiceTitle: "Fayl tekshirish uchun tokenlar",
  invoiceDescription: (tokens) => `Kunlik limitdan tashqari PDF va APK fayllarni tekshirish uchun ${tokens} token.`,
  invoiceLabel: (tokens) => `${tokens} token`,
  paymentSuccess: (tokens) =>
    "🟢 <b>TO'LOV BAJARILDI</b>\n\n" + `<b>${tokens}</b> token qo'shildi. Kutmasdan fayl tekshirishingiz mumkin.`,
  limitReached: (dailyLimit, resetIn) =>
    "⏳ <b>KUNLIK LIMIT TUGADI</b>\n\n" +
    `<blockquote>Bugungi ${dailyLimit} ta bepul tekshiruv ishlatib bo'lindi.</blockquote>\n\n` +
    `Limit <b>${resetIn}</b> dan keyin yangilanadi — yoki token sotib olib, hozir davom eting.`,

  unsupportedExt:
    "📄 <b>FORMAT QO'LLAB-QUVVATLANMAYDI</b>\n\n" +
    "<blockquote>Men faqat <b>PDF</b> va <b>APK</b> ni tekshiraman. Faylni shu formatlardan birida hujjat sifatida yuboring.</blockquote>",
  tooLarge: (sizeMb, maxMb) =>
    "📄 <b>FAYL JUDA KATTA</b>\n\n" +
    `<blockquote>Fayl hajmi — <b>${sizeMb} MB</b>, tekshiruv chegarasi esa <b>${maxMb} MB</b>.</blockquote>`,
  scanningTitle: "⏳ <b>FAYL TEKSHIRILMOQDA</b>",
  scanningTitleUrl: "⏳ <b>HAVOLA TEKSHIRILMOQDA</b>",
  urlTypeLabel: URL_LABEL_UZ,
  multipleLinksNotice: (extraCount) =>
    `ℹ️ Xabarda yana ${extraCount} ta havola bor — birinchisini tekshiryapman. ` +
    "Qolganlarini tekshirish uchun alohida xabar sifatida yuboring.",
  tooManyLinks: (found, max) =>
    "📄 <b>HAVOLALAR JUDA KO'P</b>\n\n" +
    `<blockquote>Xabarda ${found} ta havola bor, men esa bir vaqtda ko'pi bilan ${max} tasini tekshiraman. ` +
    "Havolalarni birma-bir yoki kichik guruhlarda yuboring.</blockquote>",
  steps: {
    download: "Fayl Telegramdan yuklab olinmoqda",
    search: "Bazadan qidirilmoqda",
    analyze: "~70 antivirus bilan skanerlanmoqda",
  },
  scanResult: ({ kind, fileName, fileType, fileSize, detected, total, meter, fromCache, safeBrowsing }) => {
    const isUrl = fileType === URL_LABEL_UZ;
    const icon = isUrl ? "🔗" : "📄";
    const badge = kind === "malicious" ? "🔴" : kind === "suspicious" ? "🟡" : "🟢";
    const title =
      kind === "malicious"
        ? "XAVFLI"
        : kind === "suspicious"
        ? "SHUBHALI"
        : isUrl
        ? "HAVOLA XAVFSIZ"
        : "FAYL TOZA";
    const summary =
      kind === "malicious"
        ? isUrl
          ? `${total} tadan <b>${detected}</b> tasi antivirus bu havolani zararli deb belgiladi. Unga o'tmang.`
          : `${total} tadan <b>${detected}</b> tasi antivirus faylni zararli deb belgiladi. Uni ochmang va o'rnatmang.`
        : kind === "suspicious"
        ? isUrl
          ? `${total} tadan <b>${detected}</b> tasi antivirus bu havolani shubhali deb belgiladi. Ehtiyot bo'ling.`
          : `${total} tadan <b>${detected}</b> tasi antivirus faylni shubhali deb belgiladi. Ehtiyot bo'ling.`
        : `${total} ta antivirus tekshirdi — tahdid topilmadi.`;
    return (
      `${badge} <b>${title}</b>\n\n` +
      `<blockquote>${summary}</blockquote>\n\n` +
      `${icon} <b>${fileName}</b>\n` +
      `${fileType}` + (fileSize ? `   ·   ${fileSize}` : "") + `\n\n` +
      `Aniqlanishlar: <b>${detected} / ${total}</b>\n` +
      `<code>${meter}</code>` +
      (safeBrowsing
        ? `\n🔎 Google Safe Browsing: <b>${safeBrowsing === "threat" ? "tahdid topildi" : "toza"}</b>`
        : "") +
      (fromCache ? "\n\n<i>💾 Natija bazadan — avval tekshirilgan.</i>" : "")
    );
  },
  error:
    "🔴 <b>TEKSHIRIB BO'LMADI</b>\n\n" +
    "<blockquote>Tekshiruv yoki tarmoq tomonida nimadir noto'g'ri ketdi. Bir daqiqadan so'ng qayta urinib ko'ring.</blockquote>",
  nonDocument:
    "📄 <b>FAYL YOKI HAVOLA YUBORING</b>\n\n" +
    "<blockquote>PDF yoki APK ni <b>hujjat</b> sifatida yuboring (biriktirish → Fayl), yoki havola (http/https) yuboring — men tekshiruvni boshlayman.</blockquote>",

  resetTimer: (hours, minutes) => (hours > 0 ? `${hours} soat ${minutes} daqiqa` : `${minutes} daqiqa`),

  menuCommands: [
    { command: "menu", description: "Asosiy menyu" },
    { command: "profile", description: "Profil va statistika" },
    { command: "balance", description: "Balans va tokenlar" },
    { command: "buy", description: "Token sotib olish" },
    { command: "history", description: "Oxirgi tekshiruvlar" },
    { command: "language", description: "Tilni o'zgartirish" },
    { command: "help", description: "Botdan qanday foydalanish" },
  ],
};

const translations: Record<Lang, Translations> = { ru, en, uz };

export function t(lang: Lang): Translations {
  return translations[lang] ?? translations.ru;
}

export function isValidLang(value: string): value is Lang {
  return value === "ru" || value === "en" || value === "uz";
}
