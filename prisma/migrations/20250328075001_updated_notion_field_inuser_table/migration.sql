/*
  Warnings:

  - You are about to drop the column `notion_refresh_token` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `notion_token_expiry` on the `User` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "User" DROP COLUMN "notion_refresh_token",
DROP COLUMN "notion_token_expiry";
