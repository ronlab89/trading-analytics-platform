import type { TransactionResponse } from "@trading/contracts";

/**
 * What the table says of a transaction's state. The API has five statuses; the Figma draws three,
 * so the ones that have not finished (draft, validating, processing) read as pending. The labels
 * ("Settled", "Failed", "Pending") live in the translations, under these keys.
 */
export type TransactionDisplayStatus = "settled" | "failed" | "pending";

const displayStatuses = {
  COMPLETED: "settled",
  FAILED: "failed",
  DRAFT: "pending",
  VALIDATING: "pending",
  PROCESSING: "pending",
} as const satisfies Record<TransactionResponse["status"], TransactionDisplayStatus>;

export function transactionDisplayStatus(
  status: TransactionResponse["status"],
): TransactionDisplayStatus {
  return displayStatuses[status];
}
