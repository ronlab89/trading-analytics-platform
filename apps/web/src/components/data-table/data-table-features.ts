import {
  createSortedRowModel,
  metaHelper,
  rowSortingFeature,
  sortFn_alphanumeric,
  sortFn_basic,
  sortFn_datetime,
  sortFn_text,
  tableFeatures,
  type ColumnDef,
  type RowData,
} from "@tanstack/react-table";

/** What a column says about how it is drawn; the table reads it, the cell renderers do not. */
export interface DataTableColumnMeta {
  /** Horizontal alignment of the header and its cells. Defaults to the start. */
  align?: "start" | "center" | "end";
  /** The cell names its row: it renders as a row header, so a screen reader announces the row by it. */
  rowHeader?: boolean;
}

/**
 * The table features every `DataTable` is built with. They live in one place so the column
 * definitions of each view and the table agree on the same types. Sorting is registered here but
 * stays off until a view asks for it (`useDataTable`'s `sortable`); the sort functions are the ones
 * TanStack picks on its own by the type of the values: text, alphanumeric, dates and the rest.
 */
export const dataTableFeatures = tableFeatures({
  columnMeta: metaHelper<DataTableColumnMeta>(),
  rowSortingFeature,
  sortedRowModel: createSortedRowModel(),
  sortFns: {
    alphanumeric: sortFn_alphanumeric,
    basic: sortFn_basic,
    datetime: sortFn_datetime,
    text: sortFn_text,
  },
});

export type DataTableFeatures = typeof dataTableFeatures;

/** A column of a `DataTable` over rows of type `TData`. */
export type DataTableColumn<TData extends RowData> = ColumnDef<DataTableFeatures, TData>;
