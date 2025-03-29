/*
  Warnings:

  - You are about to drop the column `one_time_code` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `one_time_code_expiry` on the `User` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "User" DROP COLUMN "one_time_code",
DROP COLUMN "one_time_code_expiry",
ADD COLUMN     "outlook_access_token" TEXT,
ADD COLUMN     "outlook_login" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "outlook_refresh_token" TEXT,
ADD COLUMN     "outlook_token_expiry" TEXT;
