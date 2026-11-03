import { useTranslation } from "react-i18next";
import { DataTable } from "@/components/data-table/data-table";
import { DataTableToolbar } from "@/components/data-table/data-table-toolbar";
import { useDataTable } from "@/components/data-table/use-data-table";
import { PortfoliosEmptyState } from "@/features/portfolios/components/portfolios-empty-state";
import { Button } from "@/components/ui/button";
import { useWatchlistColumns } from "../hooks/use-watchlist-columns";
import type { WatchlistRow } from "../types";
import { WatchlistCardList } from "./watchlist-card-list";
import { WatchlistRemoveButton } from "./watchlist-remove-button";

function assetId(row: WatchlistRow) {
  return row.assetId;
}

/**
 * The watchlist with its search: a table on the tablet and the desktop, a card list on a phone. The
 * list is short and loaded whole, so the search and the sort of the columns run in the client, on
 * one table instance the two layouts share. The loading, empty and error states belong to the
 * section. `onRemove` must be stable, or the columns rebuild.
 */
export function WatchlistView({
  rows,
  onRemove,
  mobile = false,
}: {
  rows: readonly WatchlistRow[];
  onRemove: (row: WatchlistRow) => void;
  mobile?: boolean;
}) {
  const { t } = useTranslation();
  const table = useDataTable({
    columns: useWatchlistColumns(onRemove),
    data: rows,
    getRowId: assetId,
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
          {t("markets.noResults.clear")}
        </Button>
      }
      description={t("markets.noResults.description", { query: search })}
      title={t("markets.noResults.title")}
    />
  );

  return (
    <>
      <DataTableToolbar searchLabel={t("markets.watchlistSearch")} table={table} />
      {visible.length === 0 ? (
        mobile ? (
          <section className="rounded-xl bg-(--color-surface-card) p-6">{noResults}</section>
        ) : (
          noResults
        )
      ) : mobile ? (
        <WatchlistCardList
          renderAction={(row) => <WatchlistRemoveButton onRemove={onRemove} row={row} />}
          rows={visible}
        />
      ) : (
        <DataTable aria-label={t("markets.watchlistTable")} table={table} />
      )}
    </>
  );
}
