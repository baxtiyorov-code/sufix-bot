import "dotenv/config";
import { Bot, Context, InlineKeyboard } from "grammy";
import axios from "axios";
import { scanFile, getReportByHash, sha256, scanUrl, getUrlReport, urlId } from "./virustotal";
import { checkSafeBrowsing } from "./safebrowsing";
import { prisma } from "./db";
import { t, Lang, BRAND, LANGUAGE_NAMES, isValidLang } from "./i18n";
import { consumeToken, addPaidTokens, getBalance, timeUntilReset, FREE_DAILY_LIMIT, TOKEN_PACKAGES } from "./tokens";
import { isAdmin, ADMIN_NOTIFY_CHAT_IDS } from "./admins";

/**
 * Здесь живёт вся логика бота — команды, кнопки, сканирование файлов.
 * Файл не запускает бота сам: это делают отдельные точки входа —
 * long polling для локальной разработки ([index.ts](index.ts)) и
 * webhook для serverless-хостинга (../api/webhook.ts).
 */

const BOT_TOKEN = process.env.BOT_TOKEN;
const VT_API_KEY = process.env.VIRUSTOTAL_API_KEY;
// Необязательный второй источник вердикта для ссылок. Если не задан — просто не используется.
const SAFE_BROWSING_KEY = process.env.GOOGLE_SAFE_BROWSING_API_KEY;

if (!BOT_TOKEN || !VT_API_KEY) {
  throw new Error("Не заданы BOT_TOKEN или VIRUSTOTAL_API_KEY в переменных окружения.");
}

export const bot = new Bot(BOT_TOKEN);

const ALLOWED_EXTENSIONS = [".pdf", ".apk"];
const MAX_FILE_SIZE_MB = 32; // ограничение бесплатного VirusTotal API

const HTML = { parse_mode: "HTML" } as const;

/** Фирменная подпись — добавляется снизу каждого сообщения бота. */
const FOOTER = "\n\n<i>GUARDIX — by Elvo Studio</i>";

function withFooter(text: string): string {
  return `${text}${FOOTER}`;
}

/** Отправляет новое сообщение с подписью снизу. */
function reply(ctx: Context, text: string, keyboard?: InlineKeyboard) {
  return ctx.reply(withFooter(text), { ...HTML, reply_markup: keyboard });
}

/** Редактирует сообщение бота (по ID) с подписью снизу; ошибки редактирования игнорируются. */
function editMessage(ctx: Context, messageId: number, text: string, keyboard?: InlineKeyboard) {
  return ctx.api
    .editMessageText(ctx.chat!.id, messageId, withFooter(text), { ...HTML, reply_markup: keyboard })
    .catch(() => {});
}

/** Экранирует спецсимволы HTML, чтобы имя файла не ломало разметку сообщения. */
function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** Находит все http/https-ссылки в тексте сообщения. */
const URL_PATTERN_GLOBAL = /\bhttps?:\/\/[^\s<>"']+/gi;
const MAX_LINKS_IN_MESSAGE = 15; // защита от спам-сообщений с кучей ссылок

function extractUrls(text: string): string[] {
  return [...text.matchAll(URL_PATTERN_GLOBAL)].map((m) => m[0]);
}

/** Сокращает длинную ссылку для отображения, не трогая саму ссылку для проверки. */
function truncateForDisplay(value: string, max = 70): string {
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}

// ─────────────────────────────────────────────────────────
// Визуальные примитивы
// ─────────────────────────────────────────────────────────

/** Полоса прогресса для экрана проверки, напр. «▰▰▱». */
function progressBar(step: number, total = 3): string {
  return "▰".repeat(Math.max(0, step)) + "▱".repeat(Math.max(0, total - step));
}

/** Шкала детектов для карточки результата, напр. «███░░░░░░░░░». */
function detectionMeter(hits: number, total: number): string {
  const slots = 12;
  if (total <= 0) return "░".repeat(slots);
  const raw = Math.round((hits / total) * slots);
  const filled = hits > 0 ? Math.min(slots, Math.max(1, raw)) : 0;
  return "█".repeat(filled) + "░".repeat(slots - filled);
}

// ─────────────────────────────────────────────────────────
// Клавиатуры
// ─────────────────────────────────────────────────────────

function menuKeyboard(lang: Lang, isAdminUser = false): InlineKeyboard {
  const s = t(lang);
  const kb = new InlineKeyboard()
    .text(s.navProfile, "nav:profile")
    .text(s.navHistory, "nav:history")
    .row()
    .text(s.navBalance, "nav:balance")
    .row()
    .text(s.navLanguage, "nav:language")
    .text(s.navHelp, "nav:help");
  if (isAdminUser) {
    kb.row().text(s.adminMenuButton, "au:list:0");
  }
  return kb;
}

function backKeyboard(lang: Lang): InlineKeyboard {
  return new InlineKeyboard().text(t(lang).navMenu, "nav:menu");
}

function balanceKeyboard(lang: Lang): InlineKeyboard {
  return new InlineKeyboard()
    .text(t(lang).navBuy, "open_buy")
    .row()
    .text(t(lang).navMenu, "nav:menu");
}

function buyKeyboard(lang: Lang): InlineKeyboard {
  const kb = new InlineKeyboard();
  for (const pkg of TOKEN_PACKAGES) {
    kb.text(`${pkg.tokens} ${t(lang).tokenWord} · ${pkg.stars} ⭐`, `buypkg:${pkg.tokens}:${pkg.stars}`).row();
  }
  kb.text(t(lang).navMenu, "nav:menu");
  return kb;
}

function languageKeyboard(lang: Lang): InlineKeyboard {
  return new InlineKeyboard()
    .text("🇷🇺 Русский", "lang:ru")
    .text("🇬🇧 English", "lang:en")
    .row()
    .text("🇺🇿 O'zbekcha", "lang:uz")
    .row()
    .text(t(lang).navMenu, "nav:menu");
}

// ─────────────────────────────────────────────────────────
// Хелперы
// ─────────────────────────────────────────────────────────

/** Получает язык пользователя из базы, по умолчанию "en". */
async function getUserLang(userId: number): Promise<Lang> {
  const settings = await prisma.userSettings.findUnique({
    where: { userId: BigInt(userId) },
  });
  return (settings?.language as Lang) ?? "en";
}

/** Оставшееся время до сброса дневного лимита, в текущей локали. */
function resetCountdown(lang: Lang): string {
  const { hours, minutes } = timeUntilReset();
  return t(lang).resetTimer(hours, minutes);
}

const TASHKENT_TZ = "Asia/Tashkent";

/** Форматирует дату в формате ДД.ММ.ГГГГ по ташкентскому времени, одинаково для всех языков. */
function formatDate(date: Date): string {
  const parts = new Intl.DateTimeFormat("ru-RU", {
    timeZone: TASHKENT_TZ,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${get("day")}.${get("month")}.${get("year")}`;
}

/**
 * Показывает экран: при переходе по кнопке — редактирует текущее сообщение,
 * при команде — присылает новое. Так навигация ощущается как одно «окно».
 */
async function showScreen(ctx: Context, text: string, keyboard?: InlineKeyboard): Promise<void> {
  const options = { ...HTML, reply_markup: keyboard };
  if (ctx.callbackQuery) {
    await ctx.editMessageText(withFooter(text), options).catch(() => {});
  } else {
    await ctx.reply(withFooter(text), options);
  }
}

// ─── Сборка экранов (используются и командой, и кнопкой) ───

async function heroScreen(userId: number, lang: Lang): Promise<string> {
  const s = t(lang);
  const balance = await getBalance(BigInt(userId));
  return (
    `🛡 <b>${BRAND}</b>\n` +
    `<i>${s.heroTagline}</i>\n\n` +
    s.heroBody(MAX_FILE_SIZE_MB) +
    `\n\n💳 <b>${s.menuBalanceLabel}:</b> ${s.menuBalanceValue(
      balance.freeRemaining,
      FREE_DAILY_LIMIT,
      balance.paidTokens
    )}`
  );
}

async function profileScreen(from: NonNullable<Context["from"]>, lang: Lang): Promise<string> {
  const userIdBig = BigInt(from.id);
  const [settings, total, malicious, suspicious, clean, balance] = await Promise.all([
    prisma.userSettings.findUnique({ where: { userId: userIdBig } }),
    prisma.scan.count({ where: { userId: userIdBig } }),
    prisma.scan.count({ where: { userId: userIdBig, verdict: "malicious" } }),
    prisma.scan.count({ where: { userId: userIdBig, verdict: "suspicious" } }),
    prisma.scan.count({ where: { userId: userIdBig, verdict: "clean" } }),
    getBalance(userIdBig),
  ]);

  return t(lang).profile({
    name: from.first_name,
    username: from.username ?? null,
    userId: from.id,
    language: LANGUAGE_NAMES[lang],
    memberSince: settings ? formatDate(settings.firstSeenAt) : formatDate(new Date()),
    total,
    clean,
    suspicious,
    malicious,
    isAdmin: isAdmin(from.id, from.username),
    freeRemaining: balance.freeRemaining,
    dailyLimit: FREE_DAILY_LIMIT,
    paidTokens: balance.paidTokens,
    resetIn: resetCountdown(lang),
  });
}

async function balanceScreen(userId: number, lang: Lang): Promise<string> {
  const balance = await getBalance(BigInt(userId));
  return t(lang).balanceMessage(
    balance.freeRemaining,
    FREE_DAILY_LIMIT,
    balance.paidTokens,
    resetCountdown(lang)
  );
}

async function historyScreen(userId: number, lang: Lang): Promise<string> {
  const s = t(lang);
  const scans = await prisma.scan.findMany({
    where: { userId: BigInt(userId) },
    orderBy: { createdAt: "desc" },
    take: 5,
  });

  if (scans.length === 0) {
    return `${s.historyEmpty}\n\n${s.historyEmptyHint}`;
  }

  const verdictEmoji = { clean: "🟢", suspicious: "🟡", malicious: "🔴" } as const;
  const rows = scans.map((scan) => {
    const emoji = verdictEmoji[scan.verdict as keyof typeof verdictEmoji] ?? "•";
    const typeIcon = scan.kind === "url" ? "🔗" : "📄";
    const date = scan.createdAt.toLocaleString("ru-RU", {
      timeZone: TASHKENT_TZ,
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
    return s.historyRow(emoji, typeIcon, escapeHtml(truncateForDisplay(scan.fileName, 45)), date);
  });

  return `${s.historyTitle}\n\n${rows.join("\n\n")}`;
}

/** Уведомляет админов о новом пользователе бота — каждого на его собственном языке. */
async function notifyAdminsNewUser(from: NonNullable<Context["from"]>): Promise<void> {
  const name = [from.first_name, from.last_name].filter(Boolean).join(" ");

  await Promise.all(
    ADMIN_NOTIFY_CHAT_IDS.map(async (chatId) => {
      const lang = await getUserLang(Number(chatId));
      const s = t(lang);
      const text =
        `${s.adminNewUserTitle}\n\n` +
        `${s.adminFieldName}: <b>${escapeHtml(name || "—")}</b>\n` +
        (from.username ? `${s.adminFieldNick}: @${from.username}\n` : `${s.adminNewUserNoNick}\n`) +
        `${s.adminFieldId}: <code>${from.id}</code>`;
      const kb = new InlineKeyboard().text(s.adminManageButton, `au:view:${from.id}:0`);
      await bot.api.sendMessage(chatId, text, { ...HTML, reply_markup: kb }).catch(() => {});
    })
  );
}

// Отслеживаем каждого пользователя: создаём запись при первом обращении,
// обновляем username, если он изменился, и блокируем доступ забаненным.
bot.use(async (ctx, next) => {
  if (ctx.from) {
    const existing = await prisma.userSettings.findUnique({
      where: { userId: BigInt(ctx.from.id) },
    });

    if (existing) {
      const lang = (existing.language as Lang) ?? "en";
      if (existing.blocked && !isAdmin(ctx.from.id, ctx.from.username)) {
        if (ctx.callbackQuery) {
          await ctx.answerCallbackQuery({ text: t(lang).userBlockedNotice, show_alert: true }).catch(() => {});
        } else {
          await ctx.reply(t(lang).userBlockedNotice).catch(() => {});
        }
        return;
      }
      if (existing.username !== (ctx.from.username ?? null)) {
        await prisma.userSettings.update({
          where: { userId: BigInt(ctx.from.id) },
          data: { username: ctx.from.username ?? null },
        });
      }
    } else {
      const detectedLang = isValidLang(ctx.from.language_code ?? "") ? (ctx.from.language_code as Lang) : "en";
      await prisma.userSettings.create({
        data: {
          userId: BigInt(ctx.from.id),
          username: ctx.from.username ?? null,
          language: detectedLang,
        },
      });
      await notifyAdminsNewUser(ctx.from);
    }
  }
  await next();
});

// ─────────────────────────────────────────────────────────
// Команды
// ─────────────────────────────────────────────────────────

async function sendMenu(ctx: Context): Promise<void> {
  const lang = await getUserLang(ctx.from!.id);
  const admin = isAdmin(ctx.from!.id, ctx.from!.username);
  await showScreen(ctx, await heroScreen(ctx.from!.id, lang), menuKeyboard(lang, admin));
}

bot.command(["start", "menu"], sendMenu);

bot.command("help", async (ctx) => {
  const lang = await getUserLang(ctx.from!.id);
  await reply(ctx, t(lang).help, backKeyboard(lang));
});

bot.command("language", async (ctx) => {
  const lang = await getUserLang(ctx.from!.id);
  await reply(ctx, t(lang).languagePrompt, languageKeyboard(lang));
});

bot.command("profile", async (ctx) => {
  const lang = await getUserLang(ctx.from!.id);
  await reply(ctx, await profileScreen(ctx.from!, lang), backKeyboard(lang));
});

bot.command("balance", async (ctx) => {
  const lang = await getUserLang(ctx.from!.id);
  await reply(ctx, await balanceScreen(ctx.from!.id, lang), balanceKeyboard(lang));
});

bot.command("buy", async (ctx) => {
  const lang = await getUserLang(ctx.from!.id);
  await reply(ctx, t(lang).buyTitle, buyKeyboard(lang));
});

bot.command("history", async (ctx) => {
  const lang = await getUserLang(ctx.from!.id);
  await reply(ctx, await historyScreen(ctx.from!.id, lang), backKeyboard(lang));
});

bot.command("stats", async (ctx) => {
  const lang = await getUserLang(ctx.from!.id);

  if (!isAdmin(ctx.from?.id, ctx.from?.username)) {
    await reply(ctx, t(lang).statsDenied);
    return;
  }

  const [total, malicious, suspicious, clean, uniqueUsers] = await Promise.all([
    prisma.scan.count(),
    prisma.scan.count({ where: { verdict: "malicious" } }),
    prisma.scan.count({ where: { verdict: "suspicious" } }),
    prisma.scan.count({ where: { verdict: "clean" } }),
    prisma.scan.findMany({ distinct: ["userId"], select: { userId: true } }),
  ]);

  await reply(ctx, t(lang).statsTitle({ total, clean, suspicious, malicious, users: uniqueUsers.length }), backKeyboard(lang));
});

// ─────────────────────────────────────────────────────────
// Админка: список пользователей, выдача токенов, блокировка
// ─────────────────────────────────────────────────────────

const ADMIN_PAGE_SIZE = 8;
const ADMIN_TOKEN_PRESETS = TOKEN_PACKAGES.map((pkg) => pkg.tokens); // [10, 50, 150]

/** true — доступ разрешён; иначе сама отвечает на callback и возвращает false. */
async function requireAdminCallback(ctx: Context): Promise<boolean> {
  if (isAdmin(ctx.from?.id, ctx.from?.username)) return true;
  const lang = ctx.from ? await getUserLang(ctx.from.id) : "en";
  await ctx.answerCallbackQuery({ text: t(lang).statsDenied, show_alert: true }).catch(() => {});
  return false;
}

async function adminUsersListScreen(
  page: number,
  lang: Lang
): Promise<{ text: string; keyboard: InlineKeyboard }> {
  const s = t(lang);
  const total = await prisma.userSettings.count();
  const totalPages = Math.max(1, Math.ceil(total / ADMIN_PAGE_SIZE));
  const safePage = Math.min(Math.max(0, page), totalPages - 1);

  const users = await prisma.userSettings.findMany({
    orderBy: { firstSeenAt: "desc" },
    skip: safePage * ADMIN_PAGE_SIZE,
    take: ADMIN_PAGE_SIZE,
  });

  const text = `${s.adminUsersTitle}\n\n${s.adminUsersSummary(total, safePage + 1, totalPages)}`;

  const kb = new InlineKeyboard();
  for (const u of users) {
    const label = `${u.blocked ? "🚫 " : ""}${u.username ? "@" + u.username : "id" + u.userId} · 🎟${u.paidTokens}`;
    kb.text(label, `au:view:${u.userId}:${safePage}`).row();
  }

  if (totalPages > 1) {
    if (safePage > 0) kb.text(s.adminPrevPage, `au:list:${safePage - 1}`);
    if (safePage < totalPages - 1) kb.text(s.adminNextPage, `au:list:${safePage + 1}`);
    kb.row();
  }
  kb.text(s.navMenu, "nav:menu");

  return { text, keyboard: kb };
}

async function adminUserCardScreen(
  userId: bigint,
  page: number,
  lang: Lang
): Promise<{ text: string; keyboard: InlineKeyboard }> {
  const s = t(lang);
  const [settings, scans] = await Promise.all([
    prisma.userSettings.findUnique({ where: { userId } }),
    prisma.scan.count({ where: { userId } }),
  ]);

  const kb = new InlineKeyboard();

  if (!settings) {
    return {
      text: s.adminUserNotFound,
      keyboard: kb.text(s.adminBackToList, `au:list:${page}`),
    };
  }

  const text =
    `${s.adminUserCardTitle}\n\n` +
    (settings.username ? `${s.adminFieldNick}: @${settings.username}\n` : `${s.adminFieldNick}: <i>${s.adminNoNick}</i>\n`) +
    `${s.adminFieldId}: <code>${settings.userId}</code>\n` +
    `${s.adminFieldLanguage}: <b>${settings.language}</b>\n` +
    `${s.adminFieldScans}: <b>${scans}</b>\n` +
    `${s.adminFieldTokens}: <b>${settings.paidTokens}</b>\n` +
    `${s.adminFieldStatus}: ${settings.blocked ? `<b>${s.adminStatusBlocked}</b>` : `<b>${s.adminStatusActive}</b>`}`;

  for (const amount of ADMIN_TOKEN_PRESETS) {
    kb.text(`➕${amount}`, `au:tok:${userId}:${amount}:${page}`);
  }
  kb.row();
  kb.text(
    settings.blocked ? s.adminUnblockButton : s.adminBlockButton,
    `au:block:${userId}:${page}`
  ).row();
  kb.text(s.adminBackToList, `au:list:${page}`);

  return { text, keyboard: kb };
}

bot.command("users", async (ctx) => {
  const lang = await getUserLang(ctx.from!.id);
  if (!isAdmin(ctx.from?.id, ctx.from?.username)) {
    await reply(ctx, t(lang).statsDenied);
    return;
  }
  const { text, keyboard } = await adminUsersListScreen(0, lang);
  await reply(ctx, text, keyboard);
});

bot.callbackQuery(/^au:list:(\d+)$/, async (ctx) => {
  if (!(await requireAdminCallback(ctx))) return;
  const lang = await getUserLang(ctx.from.id);
  const page = parseInt(ctx.match[1], 10);
  await ctx.answerCallbackQuery();
  const { text, keyboard } = await adminUsersListScreen(page, lang);
  await showScreen(ctx, text, keyboard);
});

bot.callbackQuery(/^au:view:(\d+):(\d+)$/, async (ctx) => {
  if (!(await requireAdminCallback(ctx))) return;
  const lang = await getUserLang(ctx.from.id);
  const userId = BigInt(ctx.match[1]);
  const page = parseInt(ctx.match[2], 10);
  await ctx.answerCallbackQuery();
  const { text, keyboard } = await adminUserCardScreen(userId, page, lang);
  await showScreen(ctx, text, keyboard);
});

bot.callbackQuery(/^au:tok:(\d+):(\d+):(\d+)$/, async (ctx) => {
  if (!(await requireAdminCallback(ctx))) return;
  const lang = await getUserLang(ctx.from.id);
  const userId = BigInt(ctx.match[1]);
  const amount = parseInt(ctx.match[2], 10);
  const page = parseInt(ctx.match[3], 10);

  await addPaidTokens(userId, amount);
  await ctx.answerCallbackQuery({ text: t(lang).adminTokensAddedToast(amount) });

  const targetLang = await getUserLang(Number(userId));
  await bot.api
    .sendMessage(userId.toString(), withFooter(t(targetLang).userTokensReceived(amount)), HTML)
    .catch(() => {});

  const { text, keyboard } = await adminUserCardScreen(userId, page, lang);
  await showScreen(ctx, text, keyboard);
});

bot.callbackQuery(/^au:block:(\d+):(\d+)$/, async (ctx) => {
  if (!(await requireAdminCallback(ctx))) return;
  const lang = await getUserLang(ctx.from.id);
  const userId = BigInt(ctx.match[1]);
  const page = parseInt(ctx.match[2], 10);

  const settings = await prisma.userSettings.findUnique({ where: { userId } });
  if (settings) {
    await prisma.userSettings.update({ where: { userId }, data: { blocked: !settings.blocked } });
  }

  const nowBlocked = !settings?.blocked;
  await ctx.answerCallbackQuery({ text: settings?.blocked ? t(lang).adminUnblockedToast : t(lang).adminBlockedToast });

  if (settings) {
    const targetLang = await getUserLang(Number(userId));
    const notice = nowBlocked ? t(targetLang).userBlockedNotice : t(targetLang).userUnblockedNotice;
    await bot.api.sendMessage(userId.toString(), withFooter(notice), HTML).catch(() => {});
  }

  const { text, keyboard } = await adminUserCardScreen(userId, page, lang);
  await showScreen(ctx, text, keyboard);
});

// ─────────────────────────────────────────────────────────
// Навигация по меню (инлайн-кнопки)
// ─────────────────────────────────────────────────────────

bot.callbackQuery("nav:menu", async (ctx) => {
  const lang = await getUserLang(ctx.from.id);
  const admin = isAdmin(ctx.from.id, ctx.from.username);
  await ctx.answerCallbackQuery();
  await showScreen(ctx, await heroScreen(ctx.from.id, lang), menuKeyboard(lang, admin));
});

bot.callbackQuery("nav:profile", async (ctx) => {
  const lang = await getUserLang(ctx.from.id);
  await ctx.answerCallbackQuery();
  await showScreen(ctx, await profileScreen(ctx.from, lang), backKeyboard(lang));
});

bot.callbackQuery("nav:history", async (ctx) => {
  const lang = await getUserLang(ctx.from.id);
  await ctx.answerCallbackQuery();
  await showScreen(ctx, await historyScreen(ctx.from.id, lang), backKeyboard(lang));
});

bot.callbackQuery("nav:balance", async (ctx) => {
  const lang = await getUserLang(ctx.from.id);
  await ctx.answerCallbackQuery();
  await showScreen(ctx, await balanceScreen(ctx.from.id, lang), balanceKeyboard(lang));
});

bot.callbackQuery("nav:help", async (ctx) => {
  const lang = await getUserLang(ctx.from.id);
  await ctx.answerCallbackQuery();
  await showScreen(ctx, t(lang).help, backKeyboard(lang));
});

bot.callbackQuery("nav:language", async (ctx) => {
  const lang = await getUserLang(ctx.from.id);
  await ctx.answerCallbackQuery();
  await showScreen(ctx, t(lang).languagePrompt, languageKeyboard(lang));
});

bot.callbackQuery(/^lang:(ru|en|uz)$/, async (ctx) => {
  const newLang = ctx.match[1] as Lang;
  if (!isValidLang(newLang)) return;

  await prisma.userSettings.upsert({
    where: { userId: BigInt(ctx.from.id) },
    update: { language: newLang },
    create: { userId: BigInt(ctx.from.id), language: newLang },
  });

  const admin = isAdmin(ctx.from.id, ctx.from.username);
  await ctx.answerCallbackQuery({ text: `${LANGUAGE_NAMES[newLang]} ✓` });
  await showScreen(ctx, await heroScreen(ctx.from.id, newLang), menuKeyboard(newLang, admin));
});

// ─────────────────────────────────────────────────────────
// Покупка токенов
// ─────────────────────────────────────────────────────────

bot.callbackQuery("open_buy", async (ctx) => {
  const lang = await getUserLang(ctx.from.id);
  await ctx.answerCallbackQuery();
  await showScreen(ctx, t(lang).buyTitle, buyKeyboard(lang));
});

bot.callbackQuery(/^buypkg:(\d+):(\d+)$/, async (ctx) => {
  const tokens = parseInt(ctx.match[1], 10);
  const stars = parseInt(ctx.match[2], 10);
  const lang = await getUserLang(ctx.from.id);

  await ctx.answerCallbackQuery();
  await ctx.replyWithInvoice(
    t(lang).invoiceTitle,
    t(lang).invoiceDescription(tokens),
    `tokens_${tokens}`,
    "XTR", // Telegram Stars
    [{ label: t(lang).invoiceLabel(tokens), amount: stars }]
  );
});

bot.on("pre_checkout_query", async (ctx) => {
  await ctx.answerPreCheckoutQuery(true);
});

bot.on("message:successful_payment", async (ctx) => {
  const payload = ctx.message.successful_payment.invoice_payload;
  const tokens = parseInt(payload.replace("tokens_", ""), 10);

  if (!Number.isNaN(tokens)) {
    await addPaidTokens(BigInt(ctx.from!.id), tokens);
  }

  const lang = await getUserLang(ctx.from!.id);
  await reply(ctx, t(lang).paymentSuccess(tokens), backKeyboard(lang));
});

// ─────────────────────────────────────────────────────────
// Обработка файлов
// ─────────────────────────────────────────────────────────

bot.on("message:document", async (ctx) => {
  const lang = await getUserLang(ctx.from!.id);
  const s = t(lang);

  const doc = ctx.message.document;
  const fileName = doc.file_name ?? "unknown_file";
  const safeFileName = escapeHtml(fileName);
  const fileSizeMb = (doc.file_size ?? 0) / (1024 * 1024);
  const fileExt = "." + (fileName.split(".").pop()?.toLowerCase() ?? "");

  if (!ALLOWED_EXTENSIONS.includes(fileExt)) {
    await reply(ctx, s.unsupportedExt, backKeyboard(lang));
    return;
  }

  if (fileSizeMb > MAX_FILE_SIZE_MB) {
    await reply(ctx, s.tooLarge(fileSizeMb.toFixed(1), MAX_FILE_SIZE_MB), backKeyboard(lang));
    return;
  }

  // Администраторы проверяют файлы без ограничений — лимит и токены не трогаем.
  if (!isAdmin(ctx.from!.id, ctx.from!.username)) {
    const tokenResult = await consumeToken(BigInt(ctx.from!.id));
    if (!tokenResult.allowed) {
      await reply(ctx, s.limitReached(FREE_DAILY_LIMIT, resetCountdown(lang)), balanceKeyboard(lang));
      return;
    }
  }

  const fileTypeLabel = fileExt === ".pdf" ? "PDF" : "APK";
  const sizeStr = `${fileSizeMb.toFixed(2)} MB`;

  const scanScreen = (step: number, label: string): string =>
    `${s.scanningTitle}\n\n` +
    `📄 <b>${safeFileName}</b>\n` +
    `${fileTypeLabel}   ·   ${sizeStr}\n\n` +
    `<code>${progressBar(step)}</code>  ${label}`;

  const statusMsg = await reply(ctx, scanScreen(1, s.steps.download));

  const updateStatus = (text: string) => editMessage(ctx, statusMsg.message_id, text);

  try {
    const file = await ctx.api.getFile(doc.file_id);
    const fileUrl = `https://api.telegram.org/file/bot${BOT_TOKEN}/${file.file_path}`;

    const fileResponse = await axios.get(fileUrl, { responseType: "arraybuffer" });
    const fileBuffer = Buffer.from(fileResponse.data);
    const fileHash = sha256(fileBuffer);

    await updateStatus(scanScreen(2, s.steps.search));

    let result = await getReportByHash(fileHash, VT_API_KEY!);
    let fromCache = true;

    if (!result) {
      fromCache = false;
      await updateStatus(scanScreen(3, s.steps.analyze));
      result = await scanFile(fileBuffer, fileName, VT_API_KEY!);
    }

    const { malicious, suspicious, harmless, undetected } = result.stats;
    const totalEngines = malicious + suspicious + harmless + undetected;

    let verdict: "clean" | "suspicious" | "malicious";
    if (malicious > 0) verdict = "malicious";
    else if (suspicious > 0) verdict = "suspicious";
    else verdict = "clean";

    const detected = verdict === "malicious" ? malicious : verdict === "suspicious" ? suspicious : 0;

    const messageText = s.scanResult({
      kind: verdict,
      fileName: safeFileName,
      fileType: fileTypeLabel,
      fileSize: sizeStr,
      detected,
      total: totalEngines,
      meter: detectionMeter(detected, totalEngines),
      fromCache,
    });

    await editMessage(ctx, statusMsg.message_id, messageText, backKeyboard(lang));

    await prisma.scan.create({
      data: {
        kind: "file",
        fileName,
        fileType: fileExt,
        fileHash,
        fileSizeMb,
        malicious,
        suspicious,
        harmless,
        undetected,
        verdict,
        userId: BigInt(ctx.from!.id),
        username: ctx.from!.username ?? null,
        chatId: BigInt(ctx.chat.id),
        permalink: result.permalink,
      },
    });
  } catch (error) {
    console.error(error);
    await editMessage(ctx, statusMsg.message_id, s.error, backKeyboard(lang));
  }
});

// ─────────────────────────────────────────────────────────
// Обработка ссылок
// ─────────────────────────────────────────────────────────

bot.on("message:text", async (ctx, next) => {
  const urls = extractUrls(ctx.message.text);
  if (urls.length === 0) {
    await next(); // не ссылка — отдаём дальше catch-all-обработчику
    return;
  }

  const lang = await getUserLang(ctx.from!.id);
  const s = t(lang);

  // Защита от спам-сообщений с кучей ссылок: не сканируем ни одной.
  if (urls.length > MAX_LINKS_IN_MESSAGE) {
    await reply(ctx, s.tooManyLinks(urls.length, MAX_LINKS_IN_MESSAGE), backKeyboard(lang));
    return;
  }

  const url = urls[0];
  const extraLinks = urls.length - 1;
  const safeUrl = escapeHtml(truncateForDisplay(url));

  // Администраторы проверяют без ограничений — лимит и токены не трогаем.
  if (!isAdmin(ctx.from!.id, ctx.from!.username)) {
    const tokenResult = await consumeToken(BigInt(ctx.from!.id));
    if (!tokenResult.allowed) {
      await reply(ctx, s.limitReached(FREE_DAILY_LIMIT, resetCountdown(lang)), balanceKeyboard(lang));
      return;
    }
  }

  const scanScreen = (step: number, label: string): string =>
    `${s.scanningTitleUrl}\n\n` +
    `🔗 <b>${safeUrl}</b>\n\n` +
    (extraLinks > 0 ? `<i>${s.multipleLinksNotice(extraLinks)}</i>\n\n` : "") +
    `<code>${progressBar(step, 2)}</code>  ${label}`;

  const statusMsg = await reply(ctx, scanScreen(1, s.steps.search));

  const updateStatus = (text: string) => editMessage(ctx, statusMsg.message_id, text);

  try {
    let result = await getUrlReport(url, VT_API_KEY!);
    let fromCache = true;

    if (!result) {
      fromCache = false;
      await updateStatus(scanScreen(2, s.steps.analyze));
      result = await scanUrl(url, VT_API_KEY!);
    }

    const { malicious, suspicious, harmless, undetected } = result.stats;
    const totalEngines = malicious + suspicious + harmless + undetected;

    let verdict: "clean" | "suspicious" | "malicious";
    if (malicious > 0) verdict = "malicious";
    else if (suspicious > 0) verdict = "suspicious";
    else verdict = "clean";

    const detected = verdict === "malicious" ? malicious : verdict === "suspicious" ? suspicious : 0;

    // Второй, независимый от VirusTotal источник — особенно силён против фишинга.
    // Если он находит угрозу, вердикт повышается до «опасно», даже если антивирусы её не поймали.
    let safeBrowsing: "clean" | "threat" | undefined;
    if (SAFE_BROWSING_KEY) {
      try {
        const sb = await checkSafeBrowsing(url, SAFE_BROWSING_KEY);
        safeBrowsing = sb.threatFound ? "threat" : "clean";
        if (sb.threatFound) verdict = "malicious";
      } catch (sbError) {
        console.error("Safe Browsing проверка не удалась:", sbError);
      }
    }

    const messageText = s.scanResult({
      kind: verdict,
      fileName: safeUrl,
      fileType: s.urlTypeLabel,
      fileSize: "",
      detected,
      total: totalEngines,
      meter: detectionMeter(detected, totalEngines),
      fromCache,
      safeBrowsing,
    });

    await editMessage(ctx, statusMsg.message_id, messageText, backKeyboard(lang));

    await prisma.scan.create({
      data: {
        kind: "url",
        fileName: url,
        fileType: "url",
        fileHash: urlId(url),
        fileSizeMb: 0,
        malicious,
        suspicious,
        harmless,
        undetected,
        verdict,
        userId: BigInt(ctx.from!.id),
        username: ctx.from!.username ?? null,
        chatId: BigInt(ctx.chat.id),
        permalink: result.permalink,
      },
    });
  } catch (error) {
    console.error(error);
    await editMessage(ctx, statusMsg.message_id, s.error, backKeyboard(lang));
  }
});

bot.on("message", async (ctx) => {
  if (!ctx.message.document) {
    const lang = await getUserLang(ctx.from!.id);
    await reply(ctx, t(lang).nonDocument, backKeyboard(lang));
  }
});

bot.catch((err) => {
  console.error("Ошибка бота:", err);
});

/** Регистрирует локализованное меню команд, About/Description и кнопку-меню в интерфейсе Telegram. */
export async function configureBotProfile(): Promise<void> {
  const langs: Lang[] = ["ru", "en", "uz"];

  await bot.api.setMyCommands(t("en").menuCommands);
  await bot.api.setMyDescription(t("en").botDescription);
  await bot.api.setMyShortDescription(t("en").botShortDescription);

  await Promise.all(
    langs.flatMap((l) => [
      bot.api.setMyCommands(t(l).menuCommands, { language_code: l }),
      bot.api.setMyDescription(t(l).botDescription, { language_code: l }),
      bot.api.setMyShortDescription(t(l).botShortDescription, { language_code: l }),
    ])
  );

  await bot.api.setChatMenuButton({ menu_button: { type: "commands" } });
}
