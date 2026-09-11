import { AlertType } from "./enums";

/**
 * Alert entity.
 * Source: docs/05-data-model.md §22
 *
 * `condition` is intentionally a free-form string: the data model does
 * not enumerate its possible values here (unlike `type`, which has an
 * explicit list). 07-api-spec.md shows "ABOVE" as an example, but a
 * closed enum for condition is not yet defined at the data-model level,
 * so introducing one now would be inventing scope not present in the spec.
 *
 * An alert must reference at least one target (`assetId` or
 * `portfolioId`) — a PRICE alert without an asset, or a
 * PORTFOLIO_CHANGE alert without a portfolio, would be meaningless.
 */
export interface Alert {
  readonly id: string;
  readonly userId: string;
  readonly assetId: string | null;
  readonly portfolioId: string | null;
  readonly type: AlertType;
  readonly condition: string;
  readonly threshold: number;
  readonly enabled: boolean;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export type CreateAlertInput = Pick<Alert, "userId" | "type" | "condition" | "threshold"> &
  Partial<Pick<Alert, "assetId" | "portfolioId" | "enabled">>;

export class InvalidAlertError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidAlertError";
  }
}

export function validateNewAlert(input: CreateAlertInput): void {
  if (!input.userId || input.userId.trim().length === 0) {
    throw new InvalidAlertError("An alert must belong to a user.");
  }

  if (!Object.values(AlertType).includes(input.type)) {
    throw new InvalidAlertError(`Unsupported alert type: ${input.type}`);
  }

  if (!input.condition || input.condition.trim().length === 0) {
    throw new InvalidAlertError("Alert condition is required.");
  }

  if (!input.assetId && !input.portfolioId) {
    throw new InvalidAlertError("An alert must reference an asset or a portfolio.");
  }
}
