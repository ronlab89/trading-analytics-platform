import { z } from "zod";
import type { Money } from "@trading/domain";
import { allocationQuerySchema } from "./analytics.schema.js";
import { moneySchema, presentMoney } from "./response-common.schema.js";

/**
 * Response shapes for the analytics endpoints (also reused by the overview).
 * Source: 07-api-spec.md §20, §22, FR-027, FR-030/031.
 */
export const allocationResponseSchema = z.object({
  groupBy: allocationQuerySchema.shape.groupBy.unwrap(),
  groups: z.array(
    z.object({
      key: z.string(),
      label: z.string(),
      marketValue: moneySchema,
      percentage: z.number(),
    }),
  ),
});
export type AllocationResponse = z.infer<typeof allocationResponseSchema>;

export const attributionResponseSchema = z.object({
  totalUnrealizedPnL: moneySchema,
  items: z.array(
    z.object({
      assetId: z.string(),
      symbol: z.string(),
      name: z.string(),
      contribution: moneySchema,
      percentageOfTotal: z.number(),
    }),
  ),
});
export type AttributionResponse = z.infer<typeof attributionResponseSchema>;

export function presentAllocation(allocation: {
  groupBy: AllocationResponse["groupBy"];
  groups: readonly {
    key: string;
    label: string;
    marketValue: Money;
    percentage: number;
  }[];
}): AllocationResponse {
  return {
    groupBy: allocation.groupBy,
    groups: allocation.groups.map((group) => ({
      key: group.key,
      label: group.label,
      marketValue: presentMoney(group.marketValue),
      percentage: group.percentage,
    })),
  };
}

export function presentAttribution(attribution: {
  totalUnrealizedPnL: Money;
  items: readonly {
    assetId: string;
    symbol: string;
    name: string;
    contribution: Money;
    percentageOfTotal: number;
  }[];
}): AttributionResponse {
  return {
    totalUnrealizedPnL: presentMoney(attribution.totalUnrealizedPnL),
    items: attribution.items.map((item) => ({
      assetId: item.assetId,
      symbol: item.symbol,
      name: item.name,
      contribution: presentMoney(item.contribution),
      percentageOfTotal: item.percentageOfTotal,
    })),
  };
}
