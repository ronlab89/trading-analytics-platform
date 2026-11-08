import type { CreateAlertRequestBody, UpdateAlertRequestBody } from "@trading/contracts";
import { z } from "zod";
import type { AlertRow } from "./alert-row";
import { plainDecimal } from "./plain-decimal";

/** A plain decimal as a person types it: digits with an optional fraction, no sign, no separators. */
const DECIMAL = /^\d+(\.\d+)?$/;

/**
 * What the alert form checks. The threshold is text while it is typed, so its rule works on text
 * and the number is only built with the body. The messages are not shown: the form picks its own
 * per field, so they follow the language. Only the two conditions the API evaluates are offered.
 */
export const alertFormSchema = z.object({
  assetId: z.string().trim().min(1),
  condition: z.enum(["ABOVE", "BELOW"]),
  threshold: z
    .string()
    .trim()
    .refine((value) => DECIMAL.test(value) && Number(value) > 0),
  enabled: z.boolean(),
});

/** What the inputs hold while the user types. */
export type AlertFormValues = z.input<typeof alertFormSchema>;

export type AlertDirection = AlertFormValues["condition"];

/** The empty form: an alert that watches for the price going above a level, enabled. */
export function emptyAlertForm(assetId = ""): AlertFormValues {
  return { assetId, condition: "ABOVE", threshold: "", enabled: true };
}

/** The form of an alert being edited. */
export function alertFormFromRow(row: AlertRow): AlertFormValues {
  return {
    assetId: row.assetId,
    condition: row.condition === "BELOW" ? "BELOW" : "ABOVE",
    threshold: plainDecimal(row.threshold),
    enabled: row.enabled,
  };
}

/** The request that creates the alert: always a price alert, the only kind the API fires. */
export function toCreateAlertBody(
  values: z.output<typeof alertFormSchema>,
): CreateAlertRequestBody {
  return {
    assetId: values.assetId,
    type: "PRICE",
    condition: values.condition,
    threshold: Number(values.threshold),
    enabled: values.enabled,
  };
}

/**
 * The request that changes the alert: only what differs from it, since the API takes the three
 * editable fields separately. Null when nothing differs, so the form can close without a request.
 */
export function toUpdateAlertBody(
  values: z.output<typeof alertFormSchema>,
  row: AlertRow,
): UpdateAlertRequestBody | null {
  const threshold = Number(values.threshold);
  const body: UpdateAlertRequestBody = {
    ...(values.condition === row.condition ? {} : { condition: values.condition }),
    ...(threshold === row.threshold ? {} : { threshold }),
    ...(values.enabled === row.enabled ? {} : { enabled: values.enabled }),
  };
  return Object.keys(body).length === 0 ? null : body;
}
