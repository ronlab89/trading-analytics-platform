import { useTranslation } from "react-i18next";
import { DataTable } from "@/components/data-table/data-table";
import { DataTableToolbar } from "@/components/data-table/data-table-toolbar";
import { useDataTable } from "@/components/data-table/use-data-table";
import { Button } from "@/components/ui/button";
import { PortfoliosEmptyState } from "@/features/portfolios/components/portfolios-empty-state";
import { useScenarioColumns } from "../hooks/use-scenario-columns";
import type { ScenarioRow } from "../types";
import { ScenarioCardList } from "./scenario-card-list";

function scenarioId(row: ScenarioRow) {
  return row.id;
}

/**
 * The scenarios with their search: a table on the tablet and the desktop, a card list on a phone.
 * The list is short and loaded whole, so the search and the sort of the columns run in the client,
 * on one table instance the two layouts share. The loading, empty and error states belong to the
 * section.
 */
export function ScenariosView({
  rows,
  mobile = false,
}: {
  rows: readonly ScenarioRow[];
  mobile?: boolean;
}) {
  const { t } = useTranslation();
  const table = useDataTable({
    columns: useScenarioColumns(),
    data: rows,
    getRowId: scenarioId,
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
          {t("scenarios.noResults.clear")}
        </Button>
      }
      description={t("scenarios.noResults.description", { query: search })}
      title={t("scenarios.noResults.title")}
    />
  );

  return (
    <>
      <DataTableToolbar searchLabel={t("scenarios.search")} table={table} />
      {visible.length === 0 ? (
        mobile ? (
          <section className="rounded-xl bg-(--color-surface-card) p-6">{noResults}</section>
        ) : (
          noResults
        )
      ) : mobile ? (
        <ScenarioCardList rows={visible} />
      ) : (
        <DataTable aria-label={t("scenarios.table")} table={table} />
      )}
    </>
  );
}
