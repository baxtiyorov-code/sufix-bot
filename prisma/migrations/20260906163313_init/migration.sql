-- CreateTable
CREATE TABLE "Scan" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "fileName" TEXT NOT NULL,
    "fileType" TEXT NOT NULL,
    "fileHash" TEXT NOT NULL,
    "fileSizeMb" REAL NOT NULL,
    "malicious" INTEGER NOT NULL,
    "suspicious" INTEGER NOT NULL,
    "harmless" INTEGER NOT NULL,
    "undetected" INTEGER NOT NULL,
    "verdict" TEXT NOT NULL,
    "userId" BIGINT NOT NULL,
    "username" TEXT,
    "chatId" BIGINT NOT NULL,
    "permalink" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE INDEX "Scan_userId_idx" ON "Scan"("userId");

-- CreateIndex
CREATE INDEX "Scan_fileHash_idx" ON "Scan"("fileHash");
