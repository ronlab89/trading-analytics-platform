import { z } from "zod";
import type { Position, PositionMetrics } from "@trading/domain";
import {
  isoTimestampSchema,
  moneySchema,
  presentMoney,
  presentTimestamp,
} from "./response-common.schema.js";

/**
 * Response shapes for the position endpoints.
 * Source: 07-api-spec.md §12, 05-data-model.md §8, FR-012/013.
 */
export const positionResponseSchema = z.object({
  id: z.string(),
  portfolioId: z.string(),
  assetId: z.string(),
  quantity: z.number(),
  averageEntryPrice: moneySchema,
  currentPrice: moneySchema,
  openedAt: isoTimestampSchema,
  updatedAt: isoTimestampSchema,
});
export type PositionResponse = z.infer<typeof positionResponseSchema>;

export const positionMetricsResponseSchema = z.object({
  marketValue: moneySchema,
  costBasis: moneySchema,
  unrealizedPnL: moneySchema,
  unrealizedPnLPercent: z.number(),
});
export type PositionMetricsResponse = z.infer<typeof positionMetricsResponseSchema>;

export const positionDetailResponseSchema = z.object({
  position: positionResponseSchema,
  metrics: positionMetricsResponseSchema,
});
export type PositionDetailResponse = z.infer<typeof positionDetailResponseSchema>;

export function presentPosition(position: Position): PositionResponse {
  return {
    id: position.id,
    portfolioId: position.portfolioId,
    assetId: position.assetId,
    quantity: position.quantity,
    averageEntryPrice: presentMoney(position.averageEntryPrice),
    currentPrice: presentMoney(position.currentPrice),
    openedAt: presentTimestamp(position.openedAt),
    updatedAt: presentTimestamp(position.updatedAt),
  };
}

export function presentPositionMetrics(metrics: PositionMetrics): PositionMetricsResponse {
  return {
    marketValue: presentMoney(metrics.marketValue),
    costBasis: presentMoney(metrics.costBasis),
    unrealizedPnL: presentMoney(metrics.unrealizedPnL),
    unrealizedPnLPercent: metrics.unrealizedPnLPercent,
  };
}

export function presentPositionDetail(detail: {
  position: Position;
  metrics: PositionMetrics;
}): PositionDetailResponse {
  return {
    position: presentPosition(detail.position),
    metrics: presentPositionMetrics(detail.metrics),
  };
}
