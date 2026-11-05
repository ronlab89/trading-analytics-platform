import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Avatar } from "@/components/avatar";
import type { AlertRow } from "../lib/alert-row";
import { formatThreshold } from "../lib/format-threshold";
import { AlertCondition, AlertStatus } from "./alert-cells";

/**
 * The mobile list of alerts: a card of rows (symbol, name with the condition and threshold under it,
 * the status and the row's menu) instead of a table. The menu is the caller's.
 */
export function AlertCardList({
  rows,
  renderAction,
}: {
  rows: readonly AlertRow[];
  renderAction: (row: AlertRow) => ReactNode;
}) {
  const { t } = useTranslation();

  return (
    <ul
      aria-label={t("alerts.table")}
      className="flex flex-col overflow-hidden rounded-xl bg-(--color-surface-card)"
    >
      {rows.map((row) => (
        <li
          className="flex items-center gap-3 border-b border-(--color-border-default) px-4 py-3 last:border-b-0"
          key={row.id}
        >
          <Avatar initials={row.symbol ?? "—"} shape="square" size="lg" />
          <span className="flex min-w-0 flex-1 flex-col gap-1">
            <span className="truncate text-sm leading-5 font-medium text-(--color-text-default)">
              {row.name ?? t("markets.unknownAsset")}
            </span>
            <span className="truncate text-xs leading-4 text-(--color-text-secondary)">
              <AlertCondition condition={row.condition} /> {formatThreshold(row)}
            </span>
          </span>
          <AlertStatus enabled={row.enabled} />
          {renderAction(row)}
        </li>
      ))}
    </ul>
  );
}
