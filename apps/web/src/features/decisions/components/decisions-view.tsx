import { useTranslation } from "react-i18next";
import { DataTable } from "@/components/data-table/data-table";
import { DataTableToolbar } from "@/components/data-table/data-table-toolbar";
import { useDataTable } from "@/components/data-table/use-data-table";
import { Button } from "@/components/ui/button";
import { PortfoliosEmptyState } from "@/features/portfolios/components/portfolios-empty-state";
import { useDecisionColumns } from "../hooks/use-decision-columns";
import type { DecisionRow } from "../types";
import { DecisionCardList } from "./decision-card-list";

function decisionId(row: DecisionRow) {
  return row.id;
}

/**
 * The decisions with their search: a table on the tablet and the desktop, a card list on a phone.
 * The list is short and loaded whole, so the search and the sort of the columns run in the client,
 * on one table instance the two layouts share. The loading, empty and error states belong to the
 * page.
 */
export function DecisionsView({
  rows,
  mobile = false,
}: {
  rows: readonly DecisionRow[];
  mobile?: boolean;
}) {
  const { t } = useTranslation();
  const table = useDataTable({
    columns: useDecisionColumns(),
    data: rows,
    getRowId: decisionId,
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
          {t("decisions.noResults.clear")}
        </Button>
      }
      description={t("decisions.noResults.description", { query: search })}
      title={t("decisions.noResults.title")}
    />
  );

  return (
    <>
      <DataTableToolbar searchLabel={t("decisions.search")} table={table} />
      {visible.length === 0 ? (
        mobile ? (
          <section className="rounded-xl bg-(--color-surface-card) p-6">{noResults}</section>
        ) : (
          noResults
        )
      ) : mobile ? (
        <DecisionCardList rows={visible} />
      ) : (
        <DataTable aria-label={t("decisions.table")} table={table} />
      )}
    </>
  );
}
