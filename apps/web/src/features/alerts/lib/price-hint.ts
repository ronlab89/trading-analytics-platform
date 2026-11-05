import type { AlertDirection } from "./alert-form";

/**
 * What the form tells about an alert before it is saved. The API evaluates against the current
 * price: an alert fires when its condition turns from false to true, so one that is already true
 * starts disarmed and waits for the price to cross again (strictly: a price equal to the threshold
 * is not a crossing). `armed` fires at the next crossing; `already` is true now.
 */
export interface PriceHint {
  kind: "armed" | "already";
  direction: AlertDirection;
}

export function priceHint(direction: AlertDirection, threshold: number, price: number): PriceHint {
  const met = direction === "ABOVE" ? price > threshold : price < threshold;
  return { kind: met ? "already" : "armed", direction };
}
