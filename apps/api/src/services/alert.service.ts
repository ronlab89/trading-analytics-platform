import { PrismaAlertRepository } from "@trading/database";
import { validateNewAlert, type Alert, type AlertType } from "@trading/domain";
import { getAssetById } from "./asset.service.js";
import { getPortfolioById } from "./portfolio.service.js";
import { AppError } from "../errors/app-error.js";

const alertRepository = new PrismaAlertRepository();

/**
 * Returns every alert configured by a user.
 * Source: FR-053, 07-api-spec.md §27 (List Alerts).
 */
export function listAlerts(userId: string): Promise<Alert[]> {
  return alertRepository.listByUserId(userId);
}

/**
 * Returns a single alert, scoped to its owner.
 * Source: 07-api-spec.md §27.
 *
 * Same 404-on-mismatch pattern used across the API (positions,
 * transactions, portfolios): an alert belonging to another user is
 * indistinguishable from a non-existent one.
 */
export async function getAlertById(userId: string, alertId: string): Promise<Alert> {
  const alert = await alertRepository.getById(alertId);

  if (alert?.userId !== userId) {
    throw new AppError("NOT_FOUND", "The requested resource could not be found.", 404);
  }

  return alert;
}

export interface CreateAlertRequest {
  assetId?: string;
  portfolioId?: string;
  type: AlertType;
  condition: string;
  threshold: number;
  enabled?: boolean;
}

/**
 * Creates an alert for the authenticated user.
 * Source: FR-053, 07-api-spec.md §27 (Create Alert).
 *
 * Orchestration:
 *   1. If a portfolioId is given, verify it belongs to the caller
 *      (reuses getPortfolioById's own 404-on-mismatch behavior).
 *   2. If an assetId is given, verify the asset exists (reuses
 *      getAssetById's own 404).
 *   3. Run validateNewAlert (domain invariants: at least one target,
 *      valid type, non-empty condition) — a second check beyond the
 *      request schema's own refine, per 09-security-spec.md §19.
 *   4. Persist.
 */
export async function createAlert(userId: string, input: CreateAlertRequest): Promise<Alert> {
  if (input.portfolioId !== undefined) {
    await getPortfolioById(userId, input.portfolioId);
  }

  if (input.assetId !== undefined) {
    await getAssetById(input.assetId);
  }

  const createInput = {
    userId,
    type: input.type,
    condition: input.condition,
    threshold: input.threshold,
    ...(input.assetId !== undefined ? { assetId: input.assetId } : {}),
    ...(input.portfolioId !== undefined ? { portfolioId: input.portfolioId } : {}),
    ...(input.enabled !== undefined ? { enabled: input.enabled } : {}),
  };

  validateNewAlert(createInput);

  return alertRepository.create(createInput);
}

/**
 * Updates an alert's condition, threshold and/or enabled flag.
 * Source: FR-053, 07-api-spec.md §27 (Update Alert).
 *
 * Ownership checked first via getAlertById, so a caller can never
 * update another user's alert (nor learn that it exists).
 */
export async function updateAlert(
  userId: string,
  alertId: string,
  input: Partial<Pick<Alert, "condition" | "threshold" | "enabled">>,
): Promise<Alert> {
  await getAlertById(userId, alertId);

  return alertRepository.update(alertId, input);
}

/**
 * Deletes an alert.
 * Source: FR-053, 07-api-spec.md §27 (Delete Alert).
 *
 * Ownership checked first, same rationale as updateAlert.
 */
export async function deleteAlert(userId: string, alertId: string): Promise<void> {
  await getAlertById(userId, alertId);

  await alertRepository.delete(alertId);
}
