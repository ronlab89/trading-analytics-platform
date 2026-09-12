/*
  Warnings:

  - Made the column `notification_preferences` on table `user_preferences` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "user_preferences" ALTER COLUMN "notification_preferences" SET NOT NULL,
ALTER COLUMN "notification_preferences" SET DEFAULT '{}';
