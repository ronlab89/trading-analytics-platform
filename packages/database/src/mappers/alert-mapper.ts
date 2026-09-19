import type { Alert as PrismaAlert } from "../../generated/client/index.js";
import type { Alert, AlertType, CreateAlertInput } from "@trading/domain";

function toDomainAlertType(type: PrismaAlert["type"]): AlertType {
  return type;
}

export function toDomainAlert(row: PrismaAlert): Alert {
  return {
    id: row.id,
    userId: row.userId,
    assetId: row.assetId,
    portfolioId: row.portfolioId,
    type: toDomainAlertType(row.type),
    condition: row.condition,
    threshold: row.threshold,
    enabled: row.enabled,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function toPrismaCreateInput(input: CreateAlertInput) {
  return {
    userId: input.userId,
    type: input.type,
    condition: input.condition,
    threshold: input.threshold,
    ...(input.assetId !== undefined ? { assetId: input.assetId } : {}),
    ...(input.portfolioId !== undefined ? { portfolioId: input.portfolioId } : {}),
    ...(input.enabled !== undefined ? { enabled: input.enabled } : {}),
  };
}
