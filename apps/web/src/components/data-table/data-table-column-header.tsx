import { FlexRender, type Header, type RowData } from "@tanstack/react-table";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import type { DataTableFeatures } from "./data-table-features";

const sortIcon = { asc: ArrowUp, desc: ArrowDown } as const;

/**
 * The content of a header cell: its title and, when the column can be sorted, the button that
 * sorts it. The direction is announced by `aria-sort` on the cell (see `DataTable`), so the icon
 * is only for the eyes.
 */
export function DataTableColumnHeader<TData extends RowData>({
  header,
}: {
  header: Header<DataTableFeatures, TData>;
}) {
  const title = <FlexRender header={header} />;
  const { column } = header;
  if (!column.getCanSort()) return title;

  const direction = column.getIsSorted();
  const Icon = direction === false ? ArrowUpDown : sortIcon[direction];

  return (
    <button
      className="inline-flex cursor-pointer items-center gap-1 rounded-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--color-button-focus-ring)"
      onClick={column.getToggleSortingHandler()}
      type="button"
    >
      {title}
      <Icon aria-hidden="true" className="size-3.5" />
    </button>
  );
}
