import { useTable, type RowData } from "@tanstack/react-table";
import { dataTableFeatures, type DataTableColumn } from "./data-table-features";

interface UseDataTableOptions<TData extends RowData> {
  /** Keep it stable (module scope or memoized): a new array on every render rebuilds the table. */
  columns: DataTableColumn<TData>[];
  data: readonly TData[];
  /** A row's identity; the row key and, later, the selection and expansion of that row. */
  getRowId: (row: TData) => string;
  /**
   * Lets the user sort by a column; a column opts out with `enableSorting: false`. The sort runs in
   * the client, so it is only right for a list loaded in full (ADR-010 point 4): a paginated list
   * keeps the order the API gives it.
   */
  sortable?: boolean | undefined;
}

/** The table instance of a view. It binds the project's features, so a view only gives its columns and rows. */
export function useDataTable<TData extends RowData>({
  columns,
  data,
  getRowId,
  sortable = false,
}: UseDataTableOptions<TData>) {
  return useTable({
    features: dataTableFeatures,
    columns,
    data,
    getRowId,
    enableSorting: sortable,
    // By default TanStack sorts numbers descending first; every column starts ascending instead.
    sortDescFirst: false,
  });
}
