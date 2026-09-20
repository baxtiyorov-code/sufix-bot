-- CreateTable
CREATE TABLE "Scan" (
    "id" SERIAL NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileType" TEXT NOT NULL,
    "fileHash" TEXT NOT NULL,
    "fileSizeMb" DOUBLE PRECISION NOT NULL,
    "malicious" INTEGER NOT NULL,
    "suspicious" INTEGER NOT NULL,
    "harmless" INTEGER NOT NULL,
    "undetected" INTEGER NOT NULL,
    "verdict" TEXT NOT NULL,
    "userId" BIGINT NOT NULL,
    "username" TEXT,
    "chatId" BIGINT NOT NULL,
    "permalink" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Scan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserSettings" (
    "userId" BIGINT NOT NULL,
    "username" TEXT,
    "language" TEXT NOT NULL DEFAULT 'ru',
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "paidTokens" INTEGER NOT NULL DEFAULT 0,
    "freeScansUsed" INTEGER NOT NULL DEFAULT 0,
    "freeScansDate" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "UserSettings_pkey" PRIMARY KEY ("userId")
);

-- CreateIndex
CREATE INDEX "Scan_userId_idx" ON "Scan"("userId");

-- CreateIndex
CREATE INDEX "Scan_fileHash_idx" ON "Scan"("fileHash");
