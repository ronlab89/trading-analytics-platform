import type { Row, RowData } from "@tanstack/react-table";
import type { DataTableFeatures } from "./data-table-features";

/** Lower case without accents, so "educacion" finds "Educación". */
const fold = (text: string) => text.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();

/**
 * The text contains the search, ignoring case, accents and the spaces around the search. It is
 * the search of a list that has no table (the mobile card list), so both filter the same way.
 */
export function matchesText(text: string, search: string): boolean {
  return fold(text).includes(fold(search.trim()));
}

/**
 * The global filter of every `DataTable`: the cell text matches the search (`matchesText`).
 * TanStack's own `includesString` ignores case only.
 */
export function includesText<TData extends RowData>(
  row: Row<DataTableFeatures, TData>,
  columnId: string,
  filterValue: unknown,
): boolean {
  return matchesText(String(row.getValue(columnId)), String(filterValue));
}
