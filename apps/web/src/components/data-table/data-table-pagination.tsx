import type { ReactTable, RowData } from "@tanstack/react-table";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import type { DataTableFeatures } from "./data-table-features";

/**
 * The footer of a paginated table, as the Figma draws it: which rows are shown, out of how many,
 * and the page with its two buttons. It reads the instance the `DataTable` draws, so it follows the
 * search and the sorting; with no rows it draws nothing, because the view says why there are none.
 */
export function DataTablePagination<TData extends RowData>({
  table,
}: {
  table: ReactTable<DataTableFeatures, TData>;
}) {
  const { t } = useTranslation();
  const total = table.getRowCount();
  if (total === 0) return null;

  const { pageIndex, pageSize } = table.state.pagination;
  const from = pageIndex * pageSize + 1;
  const to = from + table.getRowModel().rows.length - 1;

  return (
    <div className="flex items-center justify-between gap-4 text-sm text-(--color-text-secondary)">
      <p>{t("dataTable.showing", { from, to, total })}</p>
      <nav aria-label={t("dataTable.pagination")} className="flex items-center gap-2">
        <p>{t("dataTable.page", { page: pageIndex + 1, pageCount: table.getPageCount() })}</p>
        <Button
          aria-label={t("dataTable.previousPage")}
          disabled={!table.getCanPreviousPage()}
          onClick={() => {
            table.previousPage();
          }}
          size="icon-sm"
          variant="outline"
        >
          <ChevronLeft aria-hidden="true" />
        </Button>
        <Button
          aria-label={t("dataTable.nextPage")}
          disabled={!table.getCanNextPage()}
          onClick={() => {
            table.nextPage();
          }}
          size="icon-sm"
          variant="outline"
        >
          <ChevronRight aria-hidden="true" />
        </Button>
      </nav>
    </div>
  );
}
