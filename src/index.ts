import "dotenv/config";
import { Bot, InlineKeyboard } from "grammy";
import axios from "axios";
import { scanFile, getReportByHash, sha256 } from "./virustotal";
import { prisma } from "./db";
import { t, Lang, LANGUAGE_NAMES, isValidLang } from "./i18n";
import { consumeToken, addPaidTokens, getBalance, FREE_DAILY_LIMIT, TOKEN_PACKAGES } from "./tokens";

const BOT_TOKEN = process.env.BOT_TOKEN;
const VT_API_KEY = process.env.VIRUSTOTAL_API_KEY;
const ADMIN_CHAT_ID = process.env.ADMIN_CHAT_ID;

if (!BOT_TOKEN || !VT_API_KEY) {
  console.error("Не заданы BOT_TOKEN или VIRUSTOTAL_API_KEY в .env файле.");
  process.exit(1);
}

const bot = new Bot(BOT_TOKEN);

const ALLOWED_EXTENSIONS = [".pdf", ".apk"];
const MAX_FILE_SIZE_MB = 32; // ограничение бесплатного VirusTotal API

/** Экранирует спецсимволы HTML, чтобы имя файла не ломало разметку сообщения. */
function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function isAdmin(userId: number | undefined): boolean {
  return !!ADMIN_CHAT_ID && String(userId) === ADMIN_CHAT_ID;
}

function buyKeyboard(lang: Lang): InlineKeyboard {
  const kb = new InlineKeyboard();
  for (const pkg of TOKEN_PACKAGES) {
    kb.text(`${pkg.tokens} ${t(lang).tokenWord} — ${pkg.stars} ⭐`, `buypkg:${pkg.tokens}:${pkg.stars}`).row();
  }
  return kb;
}

/** Получает язык пользователя из базы, по умолчанию "ru". */
async function getUserLang(userId: number): Promise<Lang> {
  const settings = await prisma.userSettings.findUnique({
    where: { userId: BigInt(userId) },
  });
  return (settings?.language as Lang) ?? "ru";
}

/** Форматирует дату в формате ДД.ММ.ГГГГ, одинаково для всех языков. */
function formatDate(date: Date): string {
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${day}.${month}.${date.getFullYear()}`;
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

bot.command("start", async (ctx) => {
  const lang = await getUserLang(ctx.from!.id);
  await ctx.reply(t(lang).start(MAX_FILE_SIZE_MB), { parse_mode: "HTML" });
});

bot.command("help", async (ctx) => {
  const lang = await getUserLang(ctx.from!.id);
  await ctx.reply(t(lang).help, { parse_mode: "HTML" });
});

bot.command("language", async (ctx) => {
  const lang = await getUserLang(ctx.from!.id);
  const keyboard = new InlineKeyboard()
    .text("🇷🇺 Русский", "lang:ru")
    .text("🇬🇧 English", "lang:en")
    .row()
    .text("🇺🇿 O'zbekcha", "lang:uz");

  await ctx.reply(t(lang).languagePrompt, { reply_markup: keyboard });
});

bot.callbackQuery(/^lang:(ru|en|uz)$/, async (ctx) => {
  const newLang = ctx.match[1] as Lang;
  if (!isValidLang(newLang)) return;

  await prisma.userSettings.upsert({
    where: { userId: BigInt(ctx.from.id) },
    update: { language: newLang },
    create: { userId: BigInt(ctx.from.id), language: newLang },
  });

  await ctx.answerCallbackQuery();
  await ctx.editMessageText(t(newLang).languageSaved(LANGUAGE_NAMES[newLang]), {
    parse_mode: "HTML",
  });
});

bot.command("profile", async (ctx) => {
  const lang = await getUserLang(ctx.from!.id);
  const userIdBig = BigInt(ctx.from!.id);

  const [settings, total, malicious, suspicious, clean, balance] = await Promise.all([
    prisma.userSettings.findUnique({ where: { userId: userIdBig } }),
    prisma.scan.count({ where: { userId: userIdBig } }),
    prisma.scan.count({ where: { userId: userIdBig, verdict: "malicious" } }),
    prisma.scan.count({ where: { userId: userIdBig, verdict: "suspicious" } }),
    prisma.scan.count({ where: { userId: userIdBig, verdict: "clean" } }),
    getBalance(userIdBig),
  ]);

  const memberSince = settings ? formatDate(settings.firstSeenAt) : formatDate(new Date());

  await ctx.reply(
    t(lang).profile({
      name: ctx.from!.first_name,
      username: ctx.from!.username ?? null,
      userId: ctx.from!.id,
      language: LANGUAGE_NAMES[lang],
      memberSince,
      total,
      clean,
      suspicious,
      malicious,
      isAdmin: isAdmin(ctx.from?.id),
      freeRemaining: balance.freeRemaining,
      dailyLimit: FREE_DAILY_LIMIT,
      paidTokens: balance.paidTokens,
    }),
    { parse_mode: "HTML" }
  );
});

bot.command("balance", async (ctx) => {
  const lang = await getUserLang(ctx.from!.id);
  const balance = await getBalance(BigInt(ctx.from!.id));

  await ctx.reply(
    t(lang).balanceMessage(balance.freeRemaining, FREE_DAILY_LIMIT, balance.paidTokens),
    { parse_mode: "HTML", reply_markup: new InlineKeyboard().text(t(lang).buyButton, "open_buy") }
  );
});

bot.command("buy", async (ctx) => {
  const lang = await getUserLang(ctx.from!.id);
  await ctx.reply(t(lang).buyTitle, { parse_mode: "HTML", reply_markup: buyKeyboard(lang) });
});

bot.callbackQuery("open_buy", async (ctx) => {
  const lang = await getUserLang(ctx.from.id);
  await ctx.answerCallbackQuery();
  await ctx.reply(t(lang).buyTitle, { parse_mode: "HTML", reply_markup: buyKeyboard(lang) });
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
  await ctx.reply(t(lang).paymentSuccess(tokens), { parse_mode: "HTML" });
});

bot.command("history", async (ctx) => {
  const lang = await getUserLang(ctx.from!.id);
  const scans = await prisma.scan.findMany({
    where: { userId: BigInt(ctx.from!.id) },
    orderBy: { createdAt: "desc" },
    take: 5,
  });

  if (scans.length === 0) {
    await ctx.reply(t(lang).historyEmpty);
    return;
  }

  const verdictEmoji = { clean: "✅", suspicious: "🟡", malicious: "⚠️" } as const;

  const lines = scans.map((s) => {
    const emoji = verdictEmoji[s.verdict as keyof typeof verdictEmoji] ?? "•";
    const date = s.createdAt.toLocaleString("ru-RU", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
    return `${emoji} <b>${escapeHtml(s.fileName)}</b> — ${date}`;
  });

  await ctx.reply(`${t(lang).historyTitle}\n\n${lines.join("\n")}`, {
    parse_mode: "HTML",
  });
});

bot.command("stats", async (ctx) => {
  const lang = await getUserLang(ctx.from!.id);

  if (!isAdmin(ctx.from?.id)) {
    await ctx.reply(t(lang).statsDenied);
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
    t(lang).statsTitle({
      total,
      clean,
      suspicious,
      malicious,
      users: uniqueUsers.length,
    }),
    { parse_mode: "HTML" }
  );
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
    await ctx.reply(s.unsupportedExt, { parse_mode: "HTML" });
    return;
  }

  if (fileSizeMb > MAX_FILE_SIZE_MB) {
    await ctx.reply(s.tooLarge(fileSizeMb.toFixed(1), MAX_FILE_SIZE_MB), {
      parse_mode: "HTML",
    });
    return;
  }

  const tokenResult = await consumeToken(BigInt(ctx.from!.id));
  if (!tokenResult.allowed) {
    await ctx.reply(s.limitReached(FREE_DAILY_LIMIT), {
      parse_mode: "HTML",
      reply_markup: new InlineKeyboard().text(s.buyButton, "open_buy"),
    });
    return;
  }

  const statusMsg = await ctx.reply(s.downloading);

  const updateStatus = (text: string) =>
    ctx.api
      .editMessageText(ctx.chat.id, statusMsg.message_id, text)
      .catch(() => {});

  try {
    const file = await ctx.api.getFile(doc.file_id);
    const fileUrl = `https://api.telegram.org/file/bot${BOT_TOKEN}/${file.file_path}`;

    const fileResponse = await axios.get(fileUrl, { responseType: "arraybuffer" });
    const fileBuffer = Buffer.from(fileResponse.data);
    const fileHash = sha256(fileBuffer);

    await updateStatus(s.searching);

    let result = await getReportByHash(fileHash, VT_API_KEY!);
    let fromCache = true;

    if (!result) {
      fromCache = false;
      await updateStatus(s.uploading);
      result = await scanFile(fileBuffer, fileName, VT_API_KEY!);
    }

    const { malicious, suspicious, harmless, undetected } = result.stats;
    const totalEngines = malicious + suspicious + harmless + undetected;

    let verdictEmoji: string;
    let verdictLine: string;
    let verdict: "clean" | "suspicious" | "malicious";

    if (malicious > 0) {
      verdictEmoji = "⚠️";
      verdictLine = s.verdictMalicious(malicious, totalEngines);
      verdict = "malicious";
    } else if (suspicious > 0) {
      verdictEmoji = "🟡";
      verdictLine = s.verdictSuspicious(suspicious, totalEngines);
      verdict = "suspicious";
    } else {
      verdictEmoji = "✅";
      verdictLine = s.verdictClean(totalEngines);
      verdict = "clean";
    }

    const cacheNote = fromCache ? `\n\n<i>${s.cacheNote}</i>` : "";

    const messageText =
      `${verdictEmoji} ${verdictLine}\n\n` +
      `📄 ${s.fileLabel}: <b>${safeFileName}</b>\n` +
      `📦 ${s.sizeLabel}: ${fileSizeMb.toFixed(2)} MB` +
      cacheNote;

    const keyboard = new InlineKeyboard().url(s.reportButton, result.permalink);

    await ctx.api.editMessageText(ctx.chat.id, statusMsg.message_id, messageText, {
      parse_mode: "HTML",
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
    await updateStatus(s.error);
  }
});

bot.on("message", async (ctx) => {
  if (!ctx.message.document) {
    const lang = await getUserLang(ctx.from!.id);
    await ctx.reply(t(lang).nonDocument);
  }
});

bot.catch((err) => {
  console.error("Ошибка бота:", err);
});

bot.start();
console.log("Бот запущен.");