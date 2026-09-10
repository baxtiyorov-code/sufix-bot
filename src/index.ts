import "dotenv/config";
import { Bot, Context, InlineKeyboard } from "grammy";
import axios from "axios";
import { scanFile, getReportByHash, sha256 } from "./virustotal";
import { prisma } from "./db";
import { t, Lang, BRAND, LANGUAGE_NAMES, isValidLang } from "./i18n";
import { consumeToken, addPaidTokens, getBalance, timeUntilReset, FREE_DAILY_LIMIT, TOKEN_PACKAGES } from "./tokens";
import { isAdmin } from "./admins";

const BOT_TOKEN = process.env.BOT_TOKEN;
const VT_API_KEY = process.env.VIRUSTOTAL_API_KEY;

if (!BOT_TOKEN || !VT_API_KEY) {
  console.error("Не заданы BOT_TOKEN или VIRUSTOTAL_API_KEY в .env файле.");
  process.exit(1);
}

const bot = new Bot(BOT_TOKEN);

const ALLOWED_EXTENSIONS = [".pdf", ".apk"];
const MAX_FILE_SIZE_MB = 32; // ограничение бесплатного VirusTotal API

const HTML = { parse_mode: "HTML" } as const;

/** Экранирует спецсимволы HTML, чтобы имя файла не ломало разметку сообщения. */
function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
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

function menuKeyboard(lang: Lang): InlineKeyboard {
  const s = t(lang);
  return new InlineKeyboard()
    .text(s.navProfile, "nav:profile")
    .text(s.navHistory, "nav:history")
    .row()
    .text(s.navBalance, "nav:balance")
    .row()
    .text(s.navLanguage, "nav:language")
    .text(s.navHelp, "nav:help");
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

/** Получает язык пользователя из базы, по умолчанию "ru". */
async function getUserLang(userId: number): Promise<Lang> {
  const settings = await prisma.userSettings.findUnique({
    where: { userId: BigInt(userId) },
  });
  return (settings?.language as Lang) ?? "ru";
}

/** Оставшееся время до сброса дневного лимита, в текущей локали. */
function resetCountdown(lang: Lang): string {
  const { hours, minutes } = timeUntilReset();
  return t(lang).resetTimer(hours, minutes);
}

/** Форматирует дату в формате ДД.ММ.ГГГГ, одинаково для всех языков. */
function formatDate(date: Date): string {
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${day}.${month}.${date.getFullYear()}`;
}

/**
 * Показывает экран: при переходе по кнопке — редактирует текущее сообщение,
 * при команде — присылает новое. Так навигация ощущается как одно «окно».
 */
async function showScreen(ctx: Context, text: string, keyboard?: InlineKeyboard): Promise<void> {
  const options = { ...HTML, reply_markup: keyboard };
  if (ctx.callbackQuery) {
    await ctx.editMessageText(text, options).catch(() => {});
  } else {
    await ctx.reply(text, options);
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
    const date = scan.createdAt.toLocaleString("ru-RU", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
    return s.historyRow(emoji, escapeHtml(scan.fileName), date);
  });

  return `${s.historyTitle}\n\n${rows.join("\n\n")}`;
}

// Отслеживаем каждого пользователя: создаём запись при первом обращении,
// обновляем username, если он изменился.
bot.use(async (ctx, next) => {
  if (ctx.from) {
    await prisma.userSettings.upsert({
      where: { userId: BigInt(ctx.from.id) },
      update: { username: ctx.from.username ?? null },
      create: {
        userId: BigInt(ctx.from.id),
        username: ctx.from.username ?? null,
      },
    });
  }
  await next();
});

// ─────────────────────────────────────────────────────────
// Команды
// ─────────────────────────────────────────────────────────

async function sendMenu(ctx: Context): Promise<void> {
  const lang = await getUserLang(ctx.from!.id);
  await showScreen(ctx, await heroScreen(ctx.from!.id, lang), menuKeyboard(lang));
}

bot.command(["start", "menu"], sendMenu);

bot.command("help", async (ctx) => {
  const lang = await getUserLang(ctx.from!.id);
  await ctx.reply(t(lang).help, { ...HTML, reply_markup: backKeyboard(lang) });
});

bot.command("language", async (ctx) => {
  const lang = await getUserLang(ctx.from!.id);
  await ctx.reply(t(lang).languagePrompt, { ...HTML, reply_markup: languageKeyboard(lang) });
});

bot.command("profile", async (ctx) => {
  const lang = await getUserLang(ctx.from!.id);
  await ctx.reply(await profileScreen(ctx.from!, lang), { ...HTML, reply_markup: backKeyboard(lang) });
});

bot.command("balance", async (ctx) => {
  const lang = await getUserLang(ctx.from!.id);
  await ctx.reply(await balanceScreen(ctx.from!.id, lang), { ...HTML, reply_markup: balanceKeyboard(lang) });
});

bot.command("buy", async (ctx) => {
  const lang = await getUserLang(ctx.from!.id);
  await ctx.reply(t(lang).buyTitle, { ...HTML, reply_markup: buyKeyboard(lang) });
});

bot.command("history", async (ctx) => {
  const lang = await getUserLang(ctx.from!.id);
  await ctx.reply(await historyScreen(ctx.from!.id, lang), { ...HTML, reply_markup: backKeyboard(lang) });
});

bot.command("stats", async (ctx) => {
  const lang = await getUserLang(ctx.from!.id);

  if (!isAdmin(ctx.from?.id, ctx.from?.username)) {
    await ctx.reply(t(lang).statsDenied, HTML);
    return;
  }

  const [total, malicious, suspicious, clean, uniqueUsers] = await Promise.all([
    prisma.scan.count(),
    prisma.scan.count({ where: { verdict: "malicious" } }),
    prisma.scan.count({ where: { verdict: "suspicious" } }),
    prisma.scan.count({ where: { verdict: "clean" } }),
    prisma.scan.findMany({ distinct: ["userId"], select: { userId: true } }),
  ]);

  await ctx.reply(
    t(lang).statsTitle({ total, clean, suspicious, malicious, users: uniqueUsers.length }),
    { ...HTML, reply_markup: backKeyboard(lang) }
  );
});

// ─────────────────────────────────────────────────────────
// Навигация по меню (инлайн-кнопки)
// ─────────────────────────────────────────────────────────

bot.callbackQuery("nav:menu", async (ctx) => {
  const lang = await getUserLang(ctx.from.id);
  await ctx.answerCallbackQuery();
  await showScreen(ctx, await heroScreen(ctx.from.id, lang), menuKeyboard(lang));
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

  await ctx.answerCallbackQuery({ text: `${LANGUAGE_NAMES[newLang]} ✓` });
  await showScreen(ctx, await heroScreen(ctx.from.id, newLang), menuKeyboard(newLang));
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
  await ctx.reply(t(lang).paymentSuccess(tokens), { ...HTML, reply_markup: backKeyboard(lang) });
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
    await ctx.reply(s.unsupportedExt, { ...HTML, reply_markup: backKeyboard(lang) });
    return;
  }

  if (fileSizeMb > MAX_FILE_SIZE_MB) {
    await ctx.reply(s.tooLarge(fileSizeMb.toFixed(1), MAX_FILE_SIZE_MB), {
      ...HTML,
      reply_markup: backKeyboard(lang),
    });
    return;
  }

  // Администраторы проверяют файлы без ограничений — лимит и токены не трогаем.
  if (!isAdmin(ctx.from!.id, ctx.from!.username)) {
    const tokenResult = await consumeToken(BigInt(ctx.from!.id));
    if (!tokenResult.allowed) {
      await ctx.reply(s.limitReached(FREE_DAILY_LIMIT, resetCountdown(lang)), {
        ...HTML,
        reply_markup: balanceKeyboard(lang),
      });
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

  const statusMsg = await ctx.reply(scanScreen(1, s.steps.download), HTML);

  const updateStatus = (text: string) =>
    ctx.api
      .editMessageText(ctx.chat.id, statusMsg.message_id, text, HTML)
      .catch(() => {});

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

    const keyboard = new InlineKeyboard()
      .url(s.navReport, result.permalink)
      .row()
      .text(s.navMenu, "nav:menu");

    await ctx.api.editMessageText(ctx.chat.id, statusMsg.message_id, messageText, {
      ...HTML,
      reply_markup: keyboard,
    });

    await prisma.scan.create({
      data: {
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
    await ctx.api
      .editMessageText(ctx.chat.id, statusMsg.message_id, s.error, {
        ...HTML,
        reply_markup: backKeyboard(lang),
      })
      .catch(() => {});
  }
});

bot.on("message", async (ctx) => {
  if (!ctx.message.document) {
    const lang = await getUserLang(ctx.from!.id);
    await ctx.reply(t(lang).nonDocument, { ...HTML, reply_markup: backKeyboard(lang) });
  }
});

bot.catch((err) => {
  console.error("Ошибка бота:", err);
});

/** Регистрирует локализованное меню команд и кнопку-меню в интерфейсе Telegram. */
async function configureBotProfile(): Promise<void> {
  const langs: Lang[] = ["ru", "en", "uz"];
  await bot.api.setMyCommands(t("ru").menuCommands);
  await Promise.all(
    langs.map((l) => bot.api.setMyCommands(t(l).menuCommands, { language_code: l }))
  );
  await bot.api.setChatMenuButton({ menu_button: { type: "commands" } });
}

configureBotProfile().catch((err) => console.error("Не удалось настроить меню бота:", err));

bot.start();
console.log("Бот запущен.");
