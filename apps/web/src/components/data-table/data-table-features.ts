import { metaHelper, tableFeatures, type ColumnDef, type RowData } from "@tanstack/react-table";

/** What a column says about how it is drawn; the table reads it, the cell renderers do not. */
export interface DataTableColumnMeta {
  /** Horizontal alignment of the header and its cells. Defaults to the start. */
  align?: "start" | "center" | "end";
  /** The cell names its row: it renders as a row header, so a screen reader announces the row by it. */
  rowHeader?: boolean;
}

/**
 * The table features every `DataTable` is built with. They live in one place so the column
 * definitions of each view and the table agree on the same types.
 */
export const dataTableFeatures = tableFeatures({
  columnMeta: metaHelper<DataTableColumnMeta>(),
});

export type DataTableFeatures = typeof dataTableFeatures;

/** A column of a `DataTable` over rows of type `TData`. */
export type DataTableColumn<TData extends RowData> = ColumnDef<DataTableFeatures, TData>;
