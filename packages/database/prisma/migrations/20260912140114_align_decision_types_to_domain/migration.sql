/*
  Warnings:

  - Changed the type of `type` on the `decision_events` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- CreateEnum
CREATE TYPE "decision_event_type" AS ENUM ('DECISION_CREATED', 'THESIS_RECORDED', 'POSITION_OPENED', 'PRICE_UPDATE', 'RISK_CHANGED', 'TARGET_REACHED', 'POSITION_ADJUSTED', 'POSITION_CLOSED', 'NOTE_ADDED');

-- AlterTable
ALTER TABLE "decision_events" DROP COLUMN "type",
ADD COLUMN     "type" "decision_event_type" NOT NULL;

-- AlterTable
ALTER TABLE "decisions" ALTER COLUMN "risk_level" DROP NOT NULL;
