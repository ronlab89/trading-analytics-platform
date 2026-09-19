import type { Alert, CreateAlertInput } from "../entities/alert";

/**
 * Alert repository contract.
 * Source: docs/06-architecture.md §12 (Repository Pattern)
 */
export interface AlertRepository {
  /** Source: 07-api-spec.md §27 (GET /alerts). */
  listByUserId(userId: string): Promise<Alert[]>;

  getById(id: string): Promise<Alert | null>;

  /**
   * Creates a new alert.
   * Callers are expected to have already run `validateNewAlert` (see
   * entities/alert.ts) before calling this.
   */
  create(input: CreateAlertInput): Promise<Alert>;

  /** Source: 07-api-spec.md §27 (PATCH /alerts/:alertId). */
  update(
    id: string,
    input: Partial<Pick<Alert, "condition" | "threshold" | "enabled">>,
  ): Promise<Alert>;

  /** Source: 07-api-spec.md §27 (DELETE /alerts/:alertId). */
  delete(id: string): Promise<void>;
}
