/*
  Warnings:

  - Added the required column `currency` to the `positions` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "positions" ADD COLUMN     "currency" TEXT NOT NULL;
