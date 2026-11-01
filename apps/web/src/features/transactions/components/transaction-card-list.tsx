import { useTranslation } from "react-i18next";
import { Avatar } from "@/components/avatar";
import { formatMoney } from "@/lib/format-number";
import type { TransactionRow } from "../types";
import { TransactionDate } from "./transaction-date";
import { TransactionSide } from "./transaction-side";
import { TransactionStatusBadge } from "./transaction-status-badge";

/**
 * The Figma mobile transactions: one white card whose rows are the transactions. Each row has the
 * asset with its type and date at the left, and the total with the status at the right. The
 * quantity, the price and the fees are left out, as the Figma does.
 */
export function TransactionCardList({ rows }: { rows: readonly TransactionRow[] }) {
  const { t } = useTranslation();

  return (
    <ul
      aria-label={t("transactions.table")}
      className="flex flex-col overflow-hidden rounded-xl bg-(--color-surface-card)"
    >
      {rows.map((row) => (
        <li
          className="flex items-center gap-3 border-b border-(--color-border-default) px-4 py-3 last:border-b-0"
          key={row.id}
        >
          <Avatar initials={row.symbol ?? "—"} shape="square" size="lg" />
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <span className="truncate text-sm leading-5 font-medium text-(--color-text-default)">
              {row.name ?? t("transactions.unknownAsset")}
            </span>
            <div className="flex items-center gap-2">
              <TransactionSide type={row.type} />
              <TransactionDate
                className="text-xs leading-4 text-(--color-text-secondary)"
                executedAt={row.executedAt}
              />
            </div>
          </div>
          <div className="flex flex-col items-end gap-1">
            <span className="text-sm leading-5 font-medium text-(--color-text-default)">
              {formatMoney(row.total)}
            </span>
            <TransactionStatusBadge status={row.status} />
          </div>
        </li>
      ))}
    </ul>
  );
}
