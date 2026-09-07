-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_UserSettings" (
    "userId" BIGINT NOT NULL PRIMARY KEY,
    "username" TEXT,
    "language" TEXT NOT NULL DEFAULT 'ru',
    "firstSeenAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "paidTokens" INTEGER NOT NULL DEFAULT 0,
    "freeScansUsed" INTEGER NOT NULL DEFAULT 0,
    "freeScansDate" TEXT NOT NULL DEFAULT ''
);
INSERT INTO "new_UserSettings" ("firstSeenAt", "language", "userId", "username") SELECT "firstSeenAt", "language", "userId", "username" FROM "UserSettings";
DROP TABLE "UserSettings";
ALTER TABLE "new_UserSettings" RENAME TO "UserSettings";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
