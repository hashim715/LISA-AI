/*
  Warnings:

  - You are about to drop the column `isUserRegistered` on the `User` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "User" DROP COLUMN "isUserRegistered",
ADD COLUMN     "slack_access_token" TEXT,
ADD COLUMN     "slack_login" BOOLEAN NOT NULL DEFAULT false;
