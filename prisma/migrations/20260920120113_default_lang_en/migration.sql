-- Новые пользователи получают английский по умолчанию вместо русского.
ALTER TABLE "UserSettings" ALTER COLUMN "language" SET DEFAULT 'en';
