import { useTranslation } from "react-i18next";
import { Avatar } from "@/components/avatar";
import { formatMoney, formatQuantity } from "@/lib/format-number";
import type { TransactionRow } from "../types";
import { TransactionDate } from "./transaction-date";
import { TransactionStatusBadge } from "./transaction-status-badge";

/**
 * The Figma mobile transactions: one card per transaction instead of a table. The asset and the
 * total come first, then the type with its quantity and price, then the date and the status. The
 * fees are the one thing the card leaves out, like the tablet table.
 */
export function TransactionCardList({ rows }: { rows: readonly TransactionRow[] }) {
  const { t } = useTranslation();

  return (
    <ul aria-label={t("transactions.table")} className="flex flex-col gap-3">
      {rows.map((row) => (
        <li className="flex flex-col gap-3 rounded-xl bg-(--color-surface-card) p-4" key={row.id}>
          <div className="flex items-center gap-3">
            <Avatar initials={row.symbol ?? "—"} shape="square" size="lg" />
            <span className="min-w-0 flex-1 truncate text-base leading-6 font-medium text-(--color-text-default)">
              {row.name ?? t("transactions.unknownAsset")}
            </span>
            <span className="text-base leading-6 font-medium text-(--color-text-default)">
              {formatMoney(row.total)}
            </span>
          </div>
          <p className="text-xs leading-4 text-(--color-text-secondary)">
            {t("transactions.mobile.summary", {
              type: t(`transactions.type.${row.type}`),
              quantity: formatQuantity(row.quantity),
              price: formatMoney(row.price),
            })}
          </p>
          <div className="flex items-center justify-between gap-3">
            <TransactionDate
              className="text-xs leading-4 text-(--color-text-secondary)"
              executedAt={row.executedAt}
            />
            <TransactionStatusBadge status={row.status} />
          </div>
        </li>
      ))}
    </ul>
  );
}
