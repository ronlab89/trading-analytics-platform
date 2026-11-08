-- CreateEnum
CREATE TYPE "decision_direction" AS ENUM ('LONG', 'SHORT', 'NEUTRAL');

-- CreateEnum
CREATE TYPE "scenario_status" AS ENUM ('DRAFT', 'SAVED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "notification_severity" AS ENUM ('INFO', 'SUCCESS', 'WARNING', 'ERROR');

-- CreateEnum
CREATE TYPE "alert_type" AS ENUM ('PRICE', 'PORTFOLIO_CHANGE', 'ALLOCATION', 'VOLATILITY');

-- CreateEnum
CREATE TYPE "market_price_source" AS ENUM ('MOCK', 'EXTERNAL');

-- CreateTable
CREATE TABLE "decisions" (
    "id" TEXT NOT NULL,
    "portfolio_id" TEXT NOT NULL,
    "asset_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "thesis" TEXT NOT NULL,
    "direction" "decision_direction" NOT NULL,
    "entry_price" DECIMAL(18,8),
    "target_price" DECIMAL(18,8),
    "stop_price" DECIMAL(18,8),
    "currency" TEXT,
    "risk_level" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closed_at" TIMESTAMP(3),
    "outcome" TEXT,
    "notes" TEXT,

    CONSTRAINT "decisions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "decision_events" (
    "id" TEXT NOT NULL,
    "decision_id" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "type" TEXT NOT NULL,
    "payload" JSONB NOT NULL,

    CONSTRAINT "decision_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scenarios" (
    "id" TEXT NOT NULL,
    "portfolio_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "base_snapshot_id" TEXT,
    "status" "scenario_status" NOT NULL DEFAULT 'DRAFT',
    "changes" JSONB NOT NULL DEFAULT '[]',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "scenarios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "watchlist_items" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "asset_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "watchlist_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "alerts" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "asset_id" TEXT,
    "portfolio_id" TEXT,
    "type" "alert_type" NOT NULL,
    "condition" TEXT NOT NULL,
    "threshold" DOUBLE PRECISION NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "alerts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "severity" "notification_severity" NOT NULL DEFAULT 'INFO',
    "read_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata" JSONB,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_preferences" (
    "user_id" TEXT NOT NULL,
    "theme" TEXT NOT NULL DEFAULT 'system',
    "language" TEXT NOT NULL DEFAULT 'en',
    "default_portfolio_id" TEXT,
    "reduced_motion" BOOLEAN NOT NULL DEFAULT false,
    "notification_preferences" JSONB,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_preferences_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "market_prices" (
    "asset_id" TEXT NOT NULL,
    "price" DECIMAL(18,8) NOT NULL,
    "previous_price" DECIMAL(18,8) NOT NULL,
    "change" DECIMAL(18,8) NOT NULL,
    "change_percent" DOUBLE PRECISION NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "source" "market_price_source" NOT NULL DEFAULT 'MOCK',

    CONSTRAINT "market_prices_pkey" PRIMARY KEY ("asset_id")
);

-- CreateTable
CREATE TABLE "market_events" (
    "id" TEXT NOT NULL,
    "asset_id" TEXT NOT NULL,
    "price" DECIMAL(18,8) NOT NULL,
    "currency" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "sequence" BIGINT NOT NULL,

    CONSTRAINT "market_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "historical_prices" (
    "asset_id" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "open" DECIMAL(18,8) NOT NULL,
    "high" DECIMAL(18,8) NOT NULL,
    "low" DECIMAL(18,8) NOT NULL,
    "close" DECIMAL(18,8) NOT NULL,
    "volume" DECIMAL(24,8) NOT NULL,

    CONSTRAINT "historical_prices_pkey" PRIMARY KEY ("asset_id","timestamp")
);

-- CreateIndex
CREATE INDEX "decisions_portfolio_id_idx" ON "decisions"("portfolio_id");

-- CreateIndex
CREATE INDEX "decisions_asset_id_idx" ON "decisions"("asset_id");

-- CreateIndex
CREATE INDEX "decision_events_decision_id_idx" ON "decision_events"("decision_id");

-- CreateIndex
CREATE INDEX "scenarios_portfolio_id_idx" ON "scenarios"("portfolio_id");

-- CreateIndex
CREATE UNIQUE INDEX "watchlist_items_user_id_asset_id_key" ON "watchlist_items"("user_id", "asset_id");

-- CreateIndex
CREATE INDEX "alerts_user_id_idx" ON "alerts"("user_id");

-- CreateIndex
CREATE INDEX "notifications_user_id_idx" ON "notifications"("user_id");

-- CreateIndex
CREATE INDEX "market_events_asset_id_sequence_idx" ON "market_events"("asset_id", "sequence");

-- AddForeignKey
ALTER TABLE "decisions" ADD CONSTRAINT "decisions_portfolio_id_fkey" FOREIGN KEY ("portfolio_id") REFERENCES "portfolios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "decisions" ADD CONSTRAINT "decisions_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "assets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "decision_events" ADD CONSTRAINT "decision_events_decision_id_fkey" FOREIGN KEY ("decision_id") REFERENCES "decisions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scenarios" ADD CONSTRAINT "scenarios_portfolio_id_fkey" FOREIGN KEY ("portfolio_id") REFERENCES "portfolios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "watchlist_items" ADD CONSTRAINT "watchlist_items_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "watchlist_items" ADD CONSTRAINT "watchlist_items_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_portfolio_id_fkey" FOREIGN KEY ("portfolio_id") REFERENCES "portfolios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_preferences" ADD CONSTRAINT "user_preferences_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "market_prices" ADD CONSTRAINT "market_prices_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "market_events" ADD CONSTRAINT "market_events_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "historical_prices" ADD CONSTRAINT "historical_prices_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
