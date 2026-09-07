import { PrismaClient } from "@prisma/client";

// Единый экземпляр Prisma Client на всё приложение,
// чтобы не открывать новое соединение на каждый запрос.
export const prisma = new PrismaClient();