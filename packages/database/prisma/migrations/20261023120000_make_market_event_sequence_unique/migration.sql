-- DropIndex
DROP INDEX "market_events_asset_id_sequence_idx";

-- CreateIndex
CREATE UNIQUE INDEX "market_events_asset_id_sequence_key" ON "market_events"("asset_id", "sequence");
