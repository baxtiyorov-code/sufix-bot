export type Lang = "ru" | "en" | "uz";

export const LANGUAGE_NAMES: Record<Lang, string> = {
  ru: "Русский",
  en: "English",
  uz: "O'zbekcha",
};

interface Translations {
  start: (maxSizeMb: number) => string;
  help: string;
  languagePrompt: string;
  languageSaved: (lang: string) => string;
  historyEmpty: string;
  historyTitle: string;
  statsDenied: string;
  statsTitle: (params: {
    total: number;
    clean: number;
    suspicious: number;
    malicious: number;
    users: number;
  }) => string;
  unsupportedExt: string;
  tooLarge: (sizeMb: string, maxMb: number) => string;
  downloading: string;
  searching: string;
  uploading: string;
  verdictMalicious: (malicious: number, total: number) => string;
  verdictSuspicious: (suspicious: number, total: number) => string;
  verdictClean: (total: number) => string;
  cacheNote: string;
  fileLabel: string;
  sizeLabel: string;
  reportButton: string;
  error: string;
  nonDocument: string;
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
  }) => string;
  tokenWord: string;
  buyTitle: string;
  buyButton: string;
  invoiceTitle: string;
  invoiceDescription: (tokens: number) => string;
  invoiceLabel: (tokens: number) => string;
  paymentSuccess: (tokens: number) => string;
  limitReached: (dailyLimit: number) => string;
  balanceMessage: (freeRemaining: number, dailyLimit: number, paidTokens: number) => string;
}

const ru: Translations = {
  start: (maxSizeMb) =>
    "👋 <b>Привет!</b>\n\n" +
    "Я проверяю PDF и APK файлы на угрозы через VirusTotal " +
    "(одновременно ~70 антивирусных движков).\n\n" +
    "📎 Просто отправь файл как документ.\n" +
    `📦 Максимальный размер: <b>${maxSizeMb} МБ</b>\n\n` +
    "Команды:\n" +
    "/profile — твой профиль и статистика\n" +
    "/balance — баланс токенов\n" +
    "/buy — купить токены\n" +
    "/history — твои последние проверки\n" +
    "/language — сменить язык\n" +
    "/help — как пользоваться ботом",
  help:
    "ℹ️ <b>Как пользоваться:</b>\n\n" +
    "1️⃣ Отправь файл .pdf или .apk как <b>документ</b> (не как фото/медиа)\n" +
    "2️⃣ Дождись результата — проверка занимает от пары секунд до минуты\n" +
    "3️⃣ Получишь вердикт и кнопку со ссылкой на полный отчёт\n\n" +
    "Если файл уже кто-то проверял раньше — результат придёт мгновенно.",
  languagePrompt: "🌐 Выбери язык интерфейса:",
  languageSaved: (lang) => `✅ Язык изменён на: <b>${lang}</b>`,
  historyEmpty: "📭 У тебя пока нет истории проверок.",
  historyTitle: "📜 <b>Твои последние проверки:</b>",
  statsDenied: "⛔ Эта команда доступна только администратору бота.",
  statsTitle: ({ total, clean, suspicious, malicious, users }) =>
    "📊 <b>Статистика бота</b>\n\n" +
    `Всего проверок: <b>${total}</b>\n` +
    `✅ Чистых: <b>${clean}</b>\n` +
    `🟡 Подозрительных: <b>${suspicious}</b>\n` +
    `⚠️ Опасных: <b>${malicious}</b>\n\n` +
    `👥 Уникальных пользователей: <b>${users}</b>`,
  unsupportedExt: "❌ Поддерживаются только файлы <b>.pdf</b> и <b>.apk</b>.",
  tooLarge: (sizeMb, maxMb) =>
    `❌ Файл слишком большой (<b>${sizeMb} МБ</b>). ` +
    `Лимит бесплатного VirusTotal API — <b>${maxMb} МБ</b>.`,
  downloading: "📥 Скачиваю файл...",
  searching: "🔎 Ищу файл в базе VirusTotal...",
  uploading:
    "⏳ Файл новый, загружаю и запускаю полную проверку\n(~70 антивирусов, может занять до минуты)...",
  verdictMalicious: (malicious, total) =>
    `<b>ОПАСНО</b>\n${malicious} из ${total} антивирусов пометили файл как вредоносный.`,
  verdictSuspicious: (suspicious, total) =>
    `<b>Подозрительно</b>\n${suspicious} антивирусов отметили файл как подозрительный.`,
  verdictClean: (total) =>
    `<b>Файл чист</b>\nПроверено ${total} антивирусами, угроз не найдено.`,
  cacheNote: "💾 Результат из базы VirusTotal — файл уже проверяли раньше.",
  fileLabel: "Файл",
  sizeLabel: "Размер",
  reportButton: "📊 Полный отчёт VirusTotal",
  error: "❌ Произошла ошибка при проверке файла. Попробуй ещё раз чуть позже.",
  nonDocument: "📎 Отправь мне PDF или APK файл как документ для проверки.",
  profile: ({ name, username, userId, language, memberSince, total, clean, suspicious, malicious, isAdmin, freeRemaining, dailyLimit, paidTokens }) =>
    "👤 <b>Твой профиль</b>\n\n" +
    `Имя: <b>${name}</b>\n` +
    (username ? `Username: @${username}\n` : "") +
    `ID: <code>${userId}</code>\n` +
    `Язык: <b>${language}</b>\n` +
    (isAdmin ? "Статус: <b>👑 Администратор</b>\n" : "") +
    `С ботом с: <b>${memberSince}</b>\n\n` +
    "💳 <b>Баланс</b>\n" +
    `Бесплатных проверок сегодня: <b>${freeRemaining}/${dailyLimit}</b>\n` +
    `Купленных токенов: <b>${paidTokens}</b>\n\n` +
    "📊 <b>Статистика проверок</b>\n" +
    `Всего: <b>${total}</b>\n` +
    `✅ Чистых: <b>${clean}</b>\n` +
    `🟡 Подозрительных: <b>${suspicious}</b>\n` +
    `⚠️ Опасных: <b>${malicious}</b>`,
  tokenWord: "токенов",
  buyTitle: "💳 <b>Выбери пакет токенов:</b>\n\nКаждый токен = одна проверка файла сверх дневного бесплатного лимита.",
  buyButton: "💳 Купить токены",
  invoiceTitle: "Токены для проверки файлов",
  invoiceDescription: (tokens) => `Пакет из ${tokens} токенов для проверки PDF/APK файлов сверх дневного лимита.`,
  invoiceLabel: (tokens) => `${tokens} токенов`,
  paymentSuccess: (tokens) => `✅ Оплата прошла успешно! Начислено <b>${tokens}</b> токенов.`,
  limitReached: (dailyLimit) =>
    `🚫 Ты использовал все ${dailyLimit} бесплатных проверки на сегодня.\n\n` +
    "Лимит обновится завтра, либо купи токены, чтобы проверять файлы без ожидания.",
  balanceMessage: (freeRemaining, dailyLimit, paidTokens) =>
    "💳 <b>Твой баланс</b>\n\n" +
    `Бесплатных проверок сегодня: <b>${freeRemaining}/${dailyLimit}</b>\n` +
    `Купленных токенов: <b>${paidTokens}</b>`,
};

const en: Translations = {
  start: (maxSizeMb) =>
    "👋 <b>Hi!</b>\n\n" +
    "I scan PDF and APK files for threats using VirusTotal " +
    "(~70 antivirus engines at once).\n\n" +
    "📎 Just send a file as a document.\n" +
    `📦 Max file size: <b>${maxSizeMb} MB</b>\n\n` +
    "Commands:\n" +
    "/profile — your profile and stats\n" +
    "/balance — token balance\n" +
    "/buy — buy tokens\n" +
    "/history — your recent scans\n" +
    "/language — change language\n" +
    "/help — how to use the bot",
  help:
    "ℹ️ <b>How to use:</b>\n\n" +
    "1️⃣ Send a .pdf or .apk file as a <b>document</b> (not as a photo/media)\n" +
    "2️⃣ Wait for the result — takes a few seconds to a minute\n" +
    "3️⃣ You'll get a verdict and a button with the full report\n\n" +
    "If the file was already scanned before, the result arrives instantly.",
  languagePrompt: "🌐 Choose interface language:",
  languageSaved: (lang) => `✅ Language changed to: <b>${lang}</b>`,
  historyEmpty: "📭 You don't have any scan history yet.",
  historyTitle: "📜 <b>Your recent scans:</b>",
  statsDenied: "⛔ This command is only available to the bot admin.",
  statsTitle: ({ total, clean, suspicious, malicious, users }) =>
    "📊 <b>Bot statistics</b>\n\n" +
    `Total scans: <b>${total}</b>\n` +
    `✅ Clean: <b>${clean}</b>\n` +
    `🟡 Suspicious: <b>${suspicious}</b>\n` +
    `⚠️ Malicious: <b>${malicious}</b>\n\n` +
    `👥 Unique users: <b>${users}</b>`,
  unsupportedExt: "❌ Only <b>.pdf</b> and <b>.apk</b> files are supported.",
  tooLarge: (sizeMb, maxMb) =>
    `❌ File is too large (<b>${sizeMb} MB</b>). ` +
    `Free VirusTotal API limit is <b>${maxMb} MB</b>.`,
  downloading: "📥 Downloading file...",
  searching: "🔎 Checking the VirusTotal database...",
  uploading:
    "⏳ New file, uploading and running a full scan\n(~70 antivirus engines, may take up to a minute)...",
  verdictMalicious: (malicious, total) =>
    `<b>DANGEROUS</b>\n${malicious} out of ${total} antivirus engines flagged this file as malicious.`,
  verdictSuspicious: (suspicious, total) =>
    `<b>Suspicious</b>\n${suspicious} antivirus engines flagged this file as suspicious.`,
  verdictClean: (total) =>
    `<b>File is clean</b>\nScanned by ${total} antivirus engines, no threats found.`,
  cacheNote: "💾 Result from VirusTotal's database — this file was already scanned before.",
  fileLabel: "File",
  sizeLabel: "Size",
  reportButton: "📊 Full VirusTotal report",
  error: "❌ An error occurred while scanning the file. Please try again later.",
  nonDocument: "📎 Send me a PDF or APK file as a document to scan it.",
  profile: ({ name, username, userId, language, memberSince, total, clean, suspicious, malicious, isAdmin, freeRemaining, dailyLimit, paidTokens }) =>
    "👤 <b>Your profile</b>\n\n" +
    `Name: <b>${name}</b>\n` +
    (username ? `Username: @${username}\n` : "") +
    `ID: <code>${userId}</code>\n` +
    `Language: <b>${language}</b>\n` +
    (isAdmin ? "Status: <b>👑 Admin</b>\n" : "") +
    `Member since: <b>${memberSince}</b>\n\n` +
    "💳 <b>Balance</b>\n" +
    `Free scans today: <b>${freeRemaining}/${dailyLimit}</b>\n` +
    `Purchased tokens: <b>${paidTokens}</b>\n\n` +
    "📊 <b>Scan statistics</b>\n" +
    `Total: <b>${total}</b>\n` +
    `✅ Clean: <b>${clean}</b>\n` +
    `🟡 Suspicious: <b>${suspicious}</b>\n` +
    `⚠️ Malicious: <b>${malicious}</b>`,
  tokenWord: "tokens",
  buyTitle: "💳 <b>Choose a token package:</b>\n\nEach token = one file scan beyond your daily free limit.",
  buyButton: "💳 Buy tokens",
  invoiceTitle: "Tokens for file scanning",
  invoiceDescription: (tokens) => `A package of ${tokens} tokens for scanning PDF/APK files beyond the daily limit.`,
  invoiceLabel: (tokens) => `${tokens} tokens`,
  paymentSuccess: (tokens) => `✅ Payment successful! <b>${tokens}</b> tokens have been added to your balance.`,
  limitReached: (dailyLimit) =>
    `🚫 You've used all ${dailyLimit} free scans for today.\n\n` +
    "The limit resets tomorrow, or buy tokens to keep scanning without waiting.",
  balanceMessage: (freeRemaining, dailyLimit, paidTokens) =>
    "💳 <b>Your balance</b>\n\n" +
    `Free scans today: <b>${freeRemaining}/${dailyLimit}</b>\n` +
    `Purchased tokens: <b>${paidTokens}</b>`,
};

const uz: Translations = {
  start: (maxSizeMb) =>
    "👋 <b>Salom!</b>\n\n" +
    "Men PDF va APK fayllarni VirusTotal orqali tekshiraman " +
    "(bir vaqtning o'zida ~70 ta antivirus).\n\n" +
    "📎 Faylni hujjat sifatida yuboring.\n" +
    `📦 Maksimal hajm: <b>${maxSizeMb} MB</b>\n\n` +
    "Buyruqlar:\n" +
    "/profile — profilingiz va statistika\n" +
    "/balance — token balansi\n" +
    "/buy — token sotib olish\n" +
    "/history — oxirgi tekshiruvlaring\n" +
    "/language — tilni o'zgartirish\n" +
    "/help — botdan qanday foydalanish",
  help:
    "ℹ️ <b>Qanday foydalanish:</b>\n\n" +
    "1️⃣ .pdf yoki .apk faylni <b>hujjat</b> sifatida yuboring (rasm/media emas)\n" +
    "2️⃣ Natijani kuting — bir necha soniyadan bir daqiqagacha\n" +
    "3️⃣ Xulosa va to'liq hisobot havolasi bilan tugma olasiz\n\n" +
    "Agar fayl avval tekshirilgan bo'lsa, natija darhol keladi.",
  languagePrompt: "🌐 Interfeys tilini tanlang:",
  languageSaved: (lang) => `✅ Til o'zgartirildi: <b>${lang}</b>`,
  historyEmpty: "📭 Hozircha tekshiruvlar tarixi yo'q.",
  historyTitle: "📜 <b>Oxirgi tekshiruvlaring:</b>",
  statsDenied: "⛔ Bu buyruq faqat bot administratori uchun mavjud.",
  statsTitle: ({ total, clean, suspicious, malicious, users }) =>
    "📊 <b>Bot statistikasi</b>\n\n" +
    `Jami tekshiruvlar: <b>${total}</b>\n` +
    `✅ Toza: <b>${clean}</b>\n` +
    `🟡 Shubhali: <b>${suspicious}</b>\n` +
    `⚠️ Xavfli: <b>${malicious}</b>\n\n` +
    `👥 Noyob foydalanuvchilar: <b>${users}</b>`,
  unsupportedExt: "❌ Faqat <b>.pdf</b> va <b>.apk</b> fayllar qo'llab-quvvatlanadi.",
  tooLarge: (sizeMb, maxMb) =>
    `❌ Fayl juda katta (<b>${sizeMb} MB</b>). ` +
    `Bepul VirusTotal API chegarasi — <b>${maxMb} MB</b>.`,
  downloading: "📥 Fayl yuklab olinmoqda...",
  searching: "🔎 VirusTotal bazasidan qidirilmoqda...",
  uploading:
    "⏳ Fayl yangi, yuklanmoqda va to'liq tekshiruv boshlanmoqda\n(~70 antivirus, bir daqiqagacha vaqt olishi mumkin)...",
  verdictMalicious: (malicious, total) =>
    `<b>XAVFLI</b>\n${total} tadan ${malicious} tasi antivirus bu faylni zararli deb belgiladi.`,
  verdictSuspicious: (suspicious, total) =>
    `<b>Shubhali</b>\n${suspicious} ta antivirus bu faylni shubhali deb belgiladi.`,
  verdictClean: (total) =>
    `<b>Fayl toza</b>\n${total} ta antivirus tomonidan tekshirildi, tahdid topilmadi.`,
  cacheNote: "💾 Natija VirusTotal bazasidan — bu fayl avval tekshirilgan.",
  fileLabel: "Fayl",
  sizeLabel: "Hajmi",
  reportButton: "📊 To'liq VirusTotal hisoboti",
  error: "❌ Faylni tekshirishda xatolik yuz berdi. Birozdan keyin qayta urinib ko'ring.",
  nonDocument: "📎 Tekshirish uchun menga PDF yoki APK faylni hujjat sifatida yuboring.",
  profile: ({ name, username, userId, language, memberSince, total, clean, suspicious, malicious, isAdmin, freeRemaining, dailyLimit, paidTokens }) =>
    "👤 <b>Sizning profilingiz</b>\n\n" +
    `Ism: <b>${name}</b>\n` +
    (username ? `Username: @${username}\n` : "") +
    `ID: <code>${userId}</code>\n` +
    `Til: <b>${language}</b>\n` +
    (isAdmin ? "Holat: <b>👑 Administrator</b>\n" : "") +
    `Bot bilan: <b>${memberSince}</b> dan beri\n\n` +
    "💳 <b>Balans</b>\n" +
    `Bugungi bepul tekshiruvlar: <b>${freeRemaining}/${dailyLimit}</b>\n` +
    `Sotib olingan tokenlar: <b>${paidTokens}</b>\n\n` +
    "📊 <b>Tekshiruvlar statistikasi</b>\n" +
    `Jami: <b>${total}</b>\n` +
    `✅ Toza: <b>${clean}</b>\n` +
    `🟡 Shubhali: <b>${suspicious}</b>\n` +
    `⚠️ Xavfli: <b>${malicious}</b>`,
  tokenWord: "token",
  buyTitle: "💳 <b>Token paketini tanlang:</b>\n\nHar bir token = kunlik bepul limitdan tashqari bitta fayl tekshiruvi.",
  buyButton: "💳 Token sotib olish",
  invoiceTitle: "Fayl tekshirish uchun tokenlar",
  invoiceDescription: (tokens) => `Kunlik limitdan tashqari PDF/APK fayllarni tekshirish uchun ${tokens} tokenlik paket.`,
  invoiceLabel: (tokens) => `${tokens} token`,
  paymentSuccess: (tokens) => `✅ To'lov muvaffaqiyatli o'tdi! Balansingizga <b>${tokens}</b> token qo'shildi.`,
  limitReached: (dailyLimit) =>
    `🚫 Siz bugungi ${dailyLimit} ta bepul tekshiruvni ishlatib bo'ldingiz.\n\n` +
    "Limit ertaga yangilanadi, yoki kutmasdan davom etish uchun token sotib oling.",
  balanceMessage: (freeRemaining, dailyLimit, paidTokens) =>
    "💳 <b>Sizning balansingiz</b>\n\n" +
    `Bugungi bepul tekshiruvlar: <b>${freeRemaining}/${dailyLimit}</b>\n` +
    `Sotib olingan tokenlar: <b>${paidTokens}</b>`,
};

const translations: Record<Lang, Translations> = { ru, en, uz };

export function t(lang: Lang): Translations {
  return translations[lang] ?? translations.ru;
}

export function isValidLang(value: string): value is Lang {
  return value === "ru" || value === "en" || value === "uz";
}