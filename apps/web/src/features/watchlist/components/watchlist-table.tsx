import { useTranslation } from "react-i18next";
import { DataTable } from "@/components/data-table/data-table";
import { DataTableToolbar } from "@/components/data-table/data-table-toolbar";
import { useDataTable } from "@/components/data-table/use-data-table";
import { useWatchlistColumns } from "../hooks/use-watchlist-columns";
import type { WatchlistRow } from "../types";

function assetId(row: WatchlistRow) {
  return row.assetId;
}

/**
 * The watchlist as a table with its search. The list is short and loaded whole, so the search and
 * the sort of the columns run in the client. The loading, empty and error states belong to the
 * page. `onRemove` must be stable, or the columns rebuild.
 */
export function WatchlistTable({
  rows,
  onRemove,
}: {
  rows: readonly WatchlistRow[];
  onRemove: (assetId: string) => void;
}) {
  const { t } = useTranslation();
  const table = useDataTable({
    columns: useWatchlistColumns(onRemove),
    data: rows,
    getRowId: assetId,
    sortable: true,
  });

  return (
    <div className="flex flex-col gap-4">
      <DataTableToolbar searchLabel={t("markets.watchlistSearch")} table={table} />
      <DataTable aria-label={t("markets.watchlistTable")} table={table} />
    </div>
  );
}
