-- CreateTable
CREATE TABLE "UserSettings" (
    "userId" BIGINT NOT NULL PRIMARY KEY,
    "language" TEXT NOT NULL DEFAULT 'ru'
);
