-- Позволяет администратору блокировать пользователей.
ALTER TABLE "UserSettings" ADD COLUMN "blocked" BOOLEAN NOT NULL DEFAULT false;
