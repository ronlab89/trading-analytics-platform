import { AlertType } from "../entities/enums";
import type { Alert } from "../entities/alert";
import { Money } from "../value-objects/money";

/**
 * Edge-triggered price alerts.
 * Source: ADR-007 point 9, docs/08-realtime-spec.md §22, FR-053.
 *
 * An alert fires when its condition turns from false to true and is then
 * disarmed. It re-arms only when the price has moved back past the threshold
 * by `ALERT_REARM_BAND`, so a price oscillating around the threshold fires
 * once instead of on every crossing.
 *
 * Only `PRICE` alerts on an asset with the condition `ABOVE` or `BELOW` are
 * evaluated; every other alert is never acted on.
 */

/** Fraction of the threshold the price must retreat to re-arm a fired alert. */
export const ALERT_REARM_BAND = 0.005;

export type PriceAlertDirection = "ABOVE" | "BELOW";

export type PriceAlertAction = "FIRE" | "REARM" | "NONE";

/** The direction of an evaluable price alert, or `null` when it is not one. */
export function priceAlertDirection(
  alert: Pick<Alert, "type" | "assetId" | "condition">,
): PriceAlertDirection | null {
  if (alert.type !== AlertType.PRICE || alert.assetId === null) {
    return null;
  }
  return alert.condition === "ABOVE" || alert.condition === "BELOW" ? alert.condition : null;
}

function thresholdIn(threshold: number, price: Money): Money {
  return Money.of(String(threshold), price.currency);
}

/** Strict: a price equal to the threshold is not a crossing. */
export function isPriceConditionMet(
  direction: PriceAlertDirection,
  threshold: number,
  price: Money,
): boolean {
  const limit = thresholdIn(threshold, price);
  return direction === "ABOVE" ? price.greaterThan(limit) : price.lessThan(limit);
}

/** True once the price retreated past the threshold by the re-arm band. */
export function isPriceConditionCleared(
  direction: PriceAlertDirection,
  threshold: number,
  price: Money,
): boolean {
  const limit = thresholdIn(threshold, price);
  if (direction === "ABOVE") {
    const rearmAt = limit.multiply(1 - ALERT_REARM_BAND);
    return price.lessThan(rearmAt) || price.equals(rearmAt);
  }
  const rearmAt = limit.multiply(1 + ALERT_REARM_BAND);
  return price.greaterThan(rearmAt) || price.equals(rearmAt);
}

/** What one tick does to an alert: fire it, re-arm it, or leave it alone. */
export function nextPriceAlertAction(
  direction: PriceAlertDirection,
  armed: boolean,
  threshold: number,
  price: Money,
): PriceAlertAction {
  if (armed) {
    return isPriceConditionMet(direction, threshold, price) ? "FIRE" : "NONE";
  }
  return isPriceConditionCleared(direction, threshold, price) ? "REARM" : "NONE";
}

/**
 * The armed state of an alert created or edited against the current price:
 * a condition that is already true starts disarmed, so it does not fire
 * without a crossing. With no price yet the alert starts armed.
 */
export function initialAlertArmed(
  direction: PriceAlertDirection,
  threshold: number,
  price: Money | null,
): boolean {
  return price === null || !isPriceConditionMet(direction, threshold, price);
}
