import type { Row, RowData } from "@tanstack/react-table";
import type { DataTableFeatures } from "./data-table-features";

/** Lower case without accents, so "educacion" finds "Educación". */
const fold = (text: string) => text.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();

/**
 * The global filter of every `DataTable`: the cell text contains the search, ignoring case,
 * accents and the spaces around the search. TanStack's own `includesString` ignores case only.
 */
export function includesText<TData extends RowData>(
  row: Row<DataTableFeatures, TData>,
  columnId: string,
  filterValue: unknown,
): boolean {
  const needle = fold(String(filterValue).trim());
  return fold(String(row.getValue(columnId))).includes(needle);
}
