import { createColumnHelper } from "@tanstack/react-table";
import { useMemo, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Avatar } from "@/components/avatar";
import type { DataTableFeatures } from "@/components/data-table/data-table-features";
import { formatMomentDay } from "@/lib/format-date";
import type { AlertRow } from "../lib/alert-row";
import { AlertCondition, AlertStatus } from "../components/alert-cells";
import { formatThreshold } from "../lib/format-threshold";

type ColumnKey = "asset" | "condition" | "threshold" | "status" | "updated";

const NO_ACTION = () => null;

/** A header is a component, not a string, so it follows the language without rebuilding the columns. */
function headerOf(key: ColumnKey) {
  return function Header() {
    const { t } = useTranslation();
    return t(`alerts.columns.${key}`);
  };
}

function ActionsHeader() {
  const { t } = useTranslation();
  return <span className="sr-only">{t("alerts.columns.actions")}</span>;
}

function AssetCell({ symbol, name }: Pick<AlertRow, "symbol" | "name">) {
  const { t } = useTranslation();

  return (
    <span className="flex items-center gap-3">
      <Avatar initials={symbol ?? "—"} shape="square" size="lg" />
      <span className="max-desktop:max-w-36 max-desktop:truncate">
        {name ?? t("markets.unknownAsset")}
      </span>
    </span>
  );
}

function UpdatedCell({ updatedAt }: Pick<AlertRow, "updatedAt">) {
  const { i18n } = useTranslation();
  return formatMomentDay(updatedAt, i18n.language);
}

/**
 * The columns of the alerts table: the asset, the condition, the threshold in the currency of the
 * asset, the status and when it was last updated (the tablet drops that one), and a last column for
 * what the row does (its menu). The search reads the asset column, which holds the name and the
 * symbol. They depend only on `renderAction`, which must be stable, or the columns rebuild.
 */
export function useAlertColumns(renderAction: (row: AlertRow) => ReactNode = NO_ACTION) {
  return useMemo(() => {
    const column = createColumnHelper<DataTableFeatures, AlertRow>();

    return column.columns([
      column.accessor((row) => `${row.name ?? ""} ${row.symbol ?? ""}`.trim(), {
        id: "asset",
        header: headerOf("asset"),
        meta: { rowHeader: true },
        cell: ({ row }) => <AssetCell name={row.original.name} symbol={row.original.symbol} />,
      }),
      column.accessor((row) => row.condition, {
        id: "condition",
        header: headerOf("condition"),
        enableGlobalFilter: false,
        cell: ({ row }) => <AlertCondition condition={row.original.condition} />,
      }),
      column.accessor((row) => row.threshold, {
        id: "threshold",
        header: headerOf("threshold"),
        enableGlobalFilter: false,
        meta: { align: "end" },
        cell: ({ row }) => <span className="font-medium">{formatThreshold(row.original)}</span>,
      }),
      column.accessor((row) => (row.enabled ? 1 : 0), {
        id: "status",
        header: headerOf("status"),
        enableGlobalFilter: false,
        cell: ({ row }) => <AlertStatus enabled={row.original.enabled} />,
      }),
      column.accessor((row) => row.updatedAt, {
        id: "updated",
        header: headerOf("updated"),
        enableGlobalFilter: false,
        meta: { className: "max-desktop:hidden" },
        cell: ({ row }) => <UpdatedCell updatedAt={row.original.updatedAt} />,
      }),
      column.display({
        id: "actions",
        header: ActionsHeader,
        meta: { align: "end" },
        cell: ({ row }) => renderAction(row.original),
      }),
    ]);
  }, [renderAction]);
}
