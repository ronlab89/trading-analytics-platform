-- AlterTable
ALTER TABLE "alerts" ADD COLUMN     "armed" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "last_triggered_at" TIMESTAMP(3);

-- Baseline of the stored alerts (ADR-007 point 9): a PRICE alert whose condition
-- is already true against the current price starts disarmed, so deploying does
-- not fire it without a crossing. Alerts without a price stay armed.
UPDATE "alerts" AS a
SET "armed" = false
FROM "market_prices" AS p
WHERE a."type" = 'PRICE'
  AND a."asset_id" = p."asset_id"
  AND (
    (a."condition" = 'ABOVE' AND p."price" > a."threshold")
    OR (a."condition" = 'BELOW' AND p."price" < a."threshold")
  );
