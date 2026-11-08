/*
  Warnings:

  - Made the column `exchange` on table `assets` required. This step will fail if there are existing NULL values in that column.
  - Made the column `metadata` on table `assets` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "assets" ALTER COLUMN "exchange" SET NOT NULL,
ALTER COLUMN "metadata" SET NOT NULL,
ALTER COLUMN "metadata" SET DEFAULT '{}';
