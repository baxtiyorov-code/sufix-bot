import { prisma } from "./db";

/** Сколько бесплатных проверок доступно каждому пользователю в сутки. */
export const FREE_DAILY_LIMIT = 3;

export interface TokenPackage {
  tokens: number;
  stars: number;
}

/** Пакеты токенов на продажу. Цена в Telegram Stars (⭐). */
export const TOKEN_PACKAGES: TokenPackage[] = [
  { tokens: 10, stars: 50 },
  { tokens: 50, stars: 200 },
  { tokens: 150, stars: 500 },
];

function todayUtcString(): string {
  return new Date().toISOString().slice(0, 10); // "YYYY-MM-DD"
}

/** Момент следующего сброса бесплатного лимита — ближайшая полночь по UTC. */
export function nextResetAt(): Date {
  const now = new Date();
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1)
  );
}

/** Сколько времени осталось до сброса дневного лимита. */
export function timeUntilReset(): { hours: number; minutes: number } {
  const ms = nextResetAt().getTime() - Date.now();
  const totalMinutes = Math.max(0, Math.ceil(ms / 60_000));
  return { hours: Math.floor(totalMinutes / 60), minutes: totalMinutes % 60 };
}

export interface ConsumeResult {
  allowed: boolean;
  source: "free" | "paid" | null;
  freeRemaining: number;
  paidTokens: number;
}

/**
 * Списывает одну проверку: сначала из дневного бесплатного лимита,
 * затем из купленных токенов. Возвращает, разрешена ли проверка.
 */
export async function consumeToken(userId: bigint): Promise<ConsumeResult> {
  const today = todayUtcString();

  let settings = await prisma.userSettings.findUnique({ where: { userId } });

  if (!settings) {
    settings = await prisma.userSettings.create({
      data: { userId, freeScansDate: today },
    });
  }

  let { freeScansUsed, freeScansDate, paidTokens } = settings;

  // Новый день — сбрасываем счётчик бесплатных проверок.
  if (freeScansDate !== today) {
    freeScansUsed = 0;
    freeScansDate = today;
  }

  if (freeScansUsed < FREE_DAILY_LIMIT) {
    freeScansUsed += 1;
    await prisma.userSettings.update({
      where: { userId },
      data: { freeScansUsed, freeScansDate },
    });
    return {
      allowed: true,
      source: "free",
      freeRemaining: FREE_DAILY_LIMIT - freeScansUsed,
      paidTokens,
    };
  }

  if (paidTokens > 0) {
    paidTokens -= 1;
    await prisma.userSettings.update({
      where: { userId },
      data: { paidTokens, freeScansUsed, freeScansDate },
    });
    return { allowed: true, source: "paid", freeRemaining: 0, paidTokens };
  }

  // Сохраняем сброшенную дату, даже если проверка отклонена.
  await prisma.userSettings.update({
    where: { userId },
    data: { freeScansUsed, freeScansDate },
  });

  return { allowed: false, source: null, freeRemaining: 0, paidTokens };
}

/** Начисляет купленные токены после успешной оплаты. */
export async function addPaidTokens(userId: bigint, amount: number): Promise<void> {
  await prisma.userSettings.upsert({
    where: { userId },
    update: { paidTokens: { increment: amount } },
    create: { userId, paidTokens: amount, freeScansDate: todayUtcString() },
  });
}

/** Текущий баланс для отображения (без списания). */
export async function getBalance(
  userId: bigint
): Promise<{ freeRemaining: number; paidTokens: number }> {
  const today = todayUtcString();
  const settings = await prisma.userSettings.findUnique({ where: { userId } });

  if (!settings) {
    return { freeRemaining: FREE_DAILY_LIMIT, paidTokens: 0 };
  }

  const freeRemaining =
    settings.freeScansDate === today
      ? Math.max(0, FREE_DAILY_LIMIT - settings.freeScansUsed)
      : FREE_DAILY_LIMIT;

  return { freeRemaining, paidTokens: settings.paidTokens };
}