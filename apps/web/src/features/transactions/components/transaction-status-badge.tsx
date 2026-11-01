import { Check, CircleAlert, Clock } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Badge } from "@/components/badge";
import { transactionDisplayStatus, type TransactionDisplayStatus } from "../lib/transaction-status";
import type { TransactionRow } from "../types";

/** The Figma badge of each state: settled is green, pending is orange and failed is red, each with its icon. */
const appearance = {
  settled: { tone: "success", Icon: Check },
  pending: { tone: "warning", Icon: Clock },
  failed: { tone: "error", Icon: CircleAlert },
} as const satisfies Record<TransactionDisplayStatus, object>;

/** The table and the mobile cards show the same badge. */
export function TransactionStatusBadge({ status }: Pick<TransactionRow, "status">) {
  const { t } = useTranslation();
  const display = transactionDisplayStatus(status);
  const { tone, Icon } = appearance[display];

  return (
    <Badge tone={tone}>
      <Icon aria-hidden="true" className="size-3.5" />
      {t(`transactions.status.${display}`)}
    </Badge>
  );
}
