import { FlexRender, type RowData, type Table as TableInstance } from "@tanstack/react-table";
import type { ComponentProps } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import type { DataTableColumnMeta, DataTableFeatures } from "./data-table-features";

const alignment = {
  start: "text-left",
  center: "text-center",
  end: "text-right",
} as const satisfies Record<NonNullable<DataTableColumnMeta["align"]>, string>;

type DataTableProps<TData extends RowData> = Omit<ComponentProps<typeof Table>, "children"> & {
  /** From `useDataTable`; other pieces (toolbar, pagination) read the same instance. */
  table: TableInstance<DataTableFeatures, TData>;
};

/**
 * Draws a table instance: its header groups and its rows, nothing else. The search, the filters
 * and the pagination are separate pieces that take the same instance, and what to show when
 * there are no rows is up to the view.
 */
export function DataTable<TData extends RowData>({ table, ...props }: DataTableProps<TData>) {
  return (
    <Table {...props}>
      <TableHeader>
        {table.getHeaderGroups().map((headerGroup) => (
          <TableRow className="h-auto" key={headerGroup.id}>
            {headerGroup.headers.map((header) => (
              <TableHead
                className={alignment[header.column.columnDef.meta?.align ?? "start"]}
                key={header.id}
              >
                {header.isPlaceholder ? null : <FlexRender header={header} />}
              </TableHead>
            ))}
          </TableRow>
        ))}
      </TableHeader>
      <TableBody>
        {table.getRowModel().rows.map((row) => (
          <TableRow key={row.id}>
            {row.getAllCells().map((cell) => {
              const { align = "start", rowHeader } = cell.column.columnDef.meta ?? {};
              const content = <FlexRender cell={cell} />;
              return rowHeader ? (
                <th className={cn("px-3 font-normal", alignment[align])} key={cell.id} scope="row">
                  {content}
                </th>
              ) : (
                <TableCell className={alignment[align]} key={cell.id}>
                  {content}
                </TableCell>
              );
            })}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
