import { validateNewAlert } from "@trading/domain";
import type { Alert, AlertRepository, AlertType } from "@trading/domain";
import type { Actor } from "./actor.js";
import type { AssetService } from "./asset-service.js";
import { NotFoundError } from "./errors.js";
import { ROLE_PERMISSIONS, assertPermission } from "./permissions.js";
import type { RolePermissions } from "./permissions.js";
import { assertPortfolioWritable } from "./portfolio-guard.js";
import type { PortfolioService } from "./portfolio-service.js";

export interface CreateAlertRequest {
  assetId?: string;
  portfolioId?: string;
  type: AlertType;
  condition: string;
  threshold: number;
  enabled?: boolean;
}

export interface AlertServiceDependencies {
  alertRepository: Pick<
    AlertRepository,
    "listByUserId" | "getById" | "create" | "update" | "delete"
  >;
  assetService: Pick<AssetService, "getAssetById">;
  portfolioService: Pick<PortfolioService, "getPortfolioById">;
  /** Role matrix; defaults to the application matrix. Tests inject a restricted one. */
  permissions?: RolePermissions;
}

/**
 * Alert use cases.
 * Source: FR-053, 07-api-spec.md §27.
 */
export function createAlertService(dependencies: AlertServiceDependencies) {
  const {
    alertRepository,
    assetService,
    portfolioService,
    permissions = ROLE_PERMISSIONS,
  } = dependencies;

  /** 404 when the portfolio is not the actor's, 409 when it is archived (ADR-010 point 5). */
  async function assertPortfolioOpen(actor: Actor, portfolioId: string): Promise<void> {
    assertPortfolioWritable(await portfolioService.getPortfolioById(actor, portfolioId));
  }

  /** Returns every alert configured by the actor. */
  async function listAlerts(actor: Actor): Promise<Alert[]> {
    assertPermission(actor, "alert:read", permissions);

    return alertRepository.listByUserId(actor.userId);
  }

  /**
   * Returns a single alert, scoped to its owner.
   *
   * Same 404-on-mismatch pattern used across the API: an alert belonging to
   * another user is indistinguishable from a non-existent one.
   */
  async function getAlertById(actor: Actor, alertId: string): Promise<Alert> {
    assertPermission(actor, "alert:read", permissions);

    const alert = await alertRepository.getById(alertId);

    if (alert?.userId !== actor.userId) {
      throw new NotFoundError("The requested resource could not be found.");
    }

    return alert;
  }

  /**
   * Creates an alert for the actor (FR-053).
   *
   * Orchestration:
   *   1. If a portfolioId is given, verify it belongs to the actor.
   *   2. If an assetId is given, verify the asset exists.
   *   3. Run validateNewAlert (domain invariants), a second check beyond the
   *      request schema's own refine, per 09-security-spec.md §19.
   *   4. Persist.
   */
  async function createAlert(actor: Actor, input: CreateAlertRequest): Promise<Alert> {
    assertPermission(actor, "alert:write", permissions);

    if (input.portfolioId !== undefined) {
      await assertPortfolioOpen(actor, input.portfolioId);
    }

    if (input.assetId !== undefined) {
      await assetService.getAssetById(actor, input.assetId);
    }

    const createInput = {
      userId: actor.userId,
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
   *
   * Ownership is checked first, so an actor can never update another user's
   * alert (nor learn that it exists).
   */
  async function updateAlert(
    actor: Actor,
    alertId: string,
    input: Partial<Pick<Alert, "condition" | "threshold" | "enabled">>,
  ): Promise<Alert> {
    assertPermission(actor, "alert:write", permissions);
    const alert = await getAlertById(actor, alertId);
    if (alert.portfolioId) {
      await assertPortfolioOpen(actor, alert.portfolioId);
    }

    return alertRepository.update(alertId, input);
  }

  /** Deletes an alert; ownership is checked first, same rationale as update. */
  async function deleteAlert(actor: Actor, alertId: string): Promise<void> {
    assertPermission(actor, "alert:write", permissions);
    const alert = await getAlertById(actor, alertId);
    if (alert.portfolioId) {
      await assertPortfolioOpen(actor, alert.portfolioId);
    }

    await alertRepository.delete(alertId);
  }

  return { listAlerts, getAlertById, createAlert, updateAlert, deleteAlert };
}

export type AlertService = ReturnType<typeof createAlertService>;
