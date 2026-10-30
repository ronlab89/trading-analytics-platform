import type { ReactTable, RowData } from "@tanstack/react-table";
import { Search } from "lucide-react";
import type { ReactNode } from "react";
import { Input } from "@/components/ui/input";
import type { DataTableFeatures } from "./data-table-features";

interface DataTableToolbarProps<TData extends RowData> {
  /** The same instance the `DataTable` draws: the search writes its global filter. */
  table: ReactTable<DataTableFeatures, TData>;
  /** The name and placeholder of the search, in the language of the view. */
  searchLabel: string;
  /** Waits disabled, for a list that is still loading. */
  disabled?: boolean | undefined;
  /** What sits at the right of the search: a count, a menu. */
  children?: ReactNode;
}

/** The search above a table, as the Figma draws it, with room at the right for what the view adds. */
export function DataTableToolbar<TData extends RowData>({
  table,
  searchLabel,
  disabled = false,
  children,
}: DataTableToolbarProps<TData>) {
  const search = String(table.state.globalFilter ?? "");

  return (
    <div className="flex items-center justify-between gap-4">
      <div className="relative w-70 max-w-full">
        <Search
          aria-hidden="true"
          className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-(--color-text-secondary)"
        />
        <Input
          aria-label={searchLabel}
          className="pl-9"
          disabled={disabled}
          onChange={(event) => {
            table.setGlobalFilter(event.target.value);
          }}
          placeholder={searchLabel}
          type="search"
          value={search}
        />
      </div>
      {children}
    </div>
  );
}
