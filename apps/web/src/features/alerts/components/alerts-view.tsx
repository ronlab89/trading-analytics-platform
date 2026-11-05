import { Plus } from "lucide-react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { DataTable } from "@/components/data-table/data-table";
import { DataTableToolbar } from "@/components/data-table/data-table-toolbar";
import { useDataTable } from "@/components/data-table/use-data-table";
import { Button } from "@/components/ui/button";
import { PortfoliosEmptyState } from "@/features/portfolios/components/portfolios-empty-state";
import { useAlertColumns } from "../hooks/use-alert-columns";
import type { AlertRow } from "../lib/alert-row";
import { AlertCardList } from "./alert-card-list";

function alertId(row: AlertRow) {
  return row.id;
}

/**
 * The alerts with their search: a table on the tablet and the desktop, a card list on a phone. The
 * list is short and loaded whole, so the search and the sort of the columns run in the client, on
 * one table instance the two layouts share. The loading, empty and error states belong to the
 * section. `onCreate` adds the button that creates an alert; `renderAction` is the menu at the end
 * of each row and must be stable, or the columns rebuild.
 */
export function AlertsView({
  rows,
  onCreate,
  renderAction,
  mobile = false,
}: {
  rows: readonly AlertRow[];
  onCreate?: (() => void) | undefined;
  renderAction?: ((row: AlertRow) => ReactNode) | undefined;
  mobile?: boolean;
}) {
  const { t } = useTranslation();
  const table = useDataTable({
    columns: useAlertColumns(renderAction),
    data: rows,
    getRowId: alertId,
    sortable: true,
  });
  const search = String(table.state.globalFilter ?? "").trim();
  const visible = table.getRowModel().rows.map((row) => row.original);

  const noResults = (
    <PortfoliosEmptyState
      action={
        <Button
          onClick={() => {
            table.setGlobalFilter("");
          }}
          size="sm"
          variant="outline"
        >
          {t("alerts.noResults.clear")}
        </Button>
      }
      description={t("alerts.noResults.description", { query: search })}
      title={t("alerts.noResults.title")}
    />
  );

  return (
    <>
      <DataTableToolbar searchLabel={t("alerts.search")} table={table}>
        {onCreate === undefined ? null : (
          <Button onClick={onCreate} size="sm">
            <Plus aria-hidden="true" className="size-4" />
            {t("alerts.create")}
          </Button>
        )}
      </DataTableToolbar>
      {visible.length === 0 ? (
        mobile ? (
          <section className="rounded-xl bg-(--color-surface-card) p-6">{noResults}</section>
        ) : (
          noResults
        )
      ) : mobile ? (
        <AlertCardList renderAction={renderAction ?? noAction} rows={visible} />
      ) : (
        <DataTable aria-label={t("alerts.table")} table={table} />
      )}
    </>
  );
}

function noAction() {
  return null;
}
