import { PrismaClient } from "@prisma/client";

/**
 * Единый экземпляр Prisma Client на всё приложение. Кэшируем на globalThis,
 * чтобы «тёплые» вызовы serverless-функции (Vercel) переиспользовали то же
 * соединение с базой, а не открывали новое на каждый вызов.
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

globalForPrisma.prisma = prisma;
