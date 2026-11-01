import { useTranslation } from "react-i18next";
import { Badge } from "@/components/badge";
import { transactionDisplayStatus } from "../lib/transaction-status";
import type { TransactionRow } from "../types";

/**
 * Settled is the one that reads as done; the failed one has no tone of its own until the badge has
 * a danger tone. The table and the mobile cards show the same badge.
 */
export function TransactionStatusBadge({ status }: Pick<TransactionRow, "status">) {
  const { t } = useTranslation();
  const display = transactionDisplayStatus(status);

  return (
    <Badge tone={display === "settled" ? "success" : "neutral"}>
      {t(`transactions.status.${display}`)}
    </Badge>
  );
}
