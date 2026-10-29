import { useTable, type RowData } from "@tanstack/react-table";
import { dataTableFeatures, type DataTableColumn } from "./data-table-features";

interface UseDataTableOptions<TData extends RowData> {
  /** Keep it stable (module scope or memoized): a new array on every render rebuilds the table. */
  columns: DataTableColumn<TData>[];
  data: readonly TData[];
  /** A row's identity; the row key and, later, the selection and expansion of that row. */
  getRowId: (row: TData) => string;
}

/** The table instance of a view. It binds the project's features, so a view only gives its columns and rows. */
export function useDataTable<TData extends RowData>({
  columns,
  data,
  getRowId,
}: UseDataTableOptions<TData>) {
  return useTable({ features: dataTableFeatures, columns, data, getRowId });
}
