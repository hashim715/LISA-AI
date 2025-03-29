-- AlterTable
ALTER TABLE "User" ADD COLUMN     "notion_access_token" TEXT,
ADD COLUMN     "notion_login" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "notion_refresh_token" TEXT,
ADD COLUMN     "notion_token_expiry" TEXT;
