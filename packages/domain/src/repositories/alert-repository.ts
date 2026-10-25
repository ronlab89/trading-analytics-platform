import type { Alert, CreateAlertInput } from "../entities/alert.js";

/** The fields of an alert that can change after it was created. */
export type AlertUpdate = Partial<
  Pick<Alert, "condition" | "threshold" | "enabled" | "armed" | "lastTriggeredAt">
>;

/**
 * Alert repository contract.
 * Source: docs/06-architecture.md §12 (Repository Pattern)
 */
export interface AlertRepository {
  /** Source: 07-api-spec.md §27 (GET /alerts). */
  listByUserId(userId: string): Promise<Alert[]>;

  getById(id: string): Promise<Alert | null>;

  /**
   * The enabled alerts on any of the given assets, for every owner: the one
   * query the alert evaluation makes per tick (ADR-007 point 9).
   */
  listEnabledByAssetIds(assetIds: readonly string[]): Promise<Alert[]>;

  /**
   * Creates a new alert.
   * Callers are expected to have already run `validateNewAlert` (see
   * entities/alert.ts) before calling this.
   */
  create(input: CreateAlertInput): Promise<Alert>;

  /** Source: 07-api-spec.md §27 (PATCH /alerts/:alertId). */
  update(id: string, input: AlertUpdate): Promise<Alert>;

  /** Source: 07-api-spec.md §27 (DELETE /alerts/:alertId). */
  delete(id: string): Promise<void>;
}
