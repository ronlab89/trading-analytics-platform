/*
  Warnings:

  - The `source` column on the `market_prices` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- CreateEnum
CREATE TYPE "market_data_source" AS ENUM ('MOCK', 'EXTERNAL');

-- AlterTable
ALTER TABLE "market_prices" DROP COLUMN "source",
ADD COLUMN     "source" "market_data_source" NOT NULL DEFAULT 'MOCK';

-- DropEnum
DROP TYPE "market_price_source";
