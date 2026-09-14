/*
  Warnings:

  - Added the required column `currency` to the `historical_prices` table without a default value. This is not possible if the table is not empty.
  - Added the required column `currency` to the `market_prices` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "historical_prices" ADD COLUMN     "currency" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "market_prices" ADD COLUMN     "currency" TEXT NOT NULL;
