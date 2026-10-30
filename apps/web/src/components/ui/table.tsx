import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

/**
 * The markup of the Figma "Table": semantic elements with the project's spacing and tokens, and
 * no behavior. `DataTable` fills them from a TanStack Table instance.
 */
function Table({ className, ...props }: ComponentProps<"table">) {
  return (
    <table
      className={cn("w-full border-collapse text-sm", className)}
      data-slot="table"
      {...props}
    />
  );
}

function TableHeader({ className, ...props }: ComponentProps<"thead">) {
  return (
    <thead
      className={cn("[&_tr]:border-b [&_tr]:border-(--color-border-default)", className)}
      data-slot="table-header"
      {...props}
    />
  );
}

function TableBody({ className, ...props }: ComponentProps<"tbody">) {
  return <tbody className={cn(className)} data-slot="table-body" {...props} />;
}

function TableRow({ className, ...props }: ComponentProps<"tr">) {
  return (
    <tr
      className={cn("h-12 border-b border-(--color-border-default)", className)}
      data-slot="table-row"
      {...props}
    />
  );
}

function TableHead({ className, ...props }: ComponentProps<"th">) {
  return (
    <th
      className={cn(
        "px-3 py-3 text-left text-xs font-semibold text-(--color-text-secondary)",
        className,
      )}
      data-slot="table-head"
      scope="col"
      {...props}
    />
  );
}

function TableCell({ className, ...props }: ComponentProps<"td">) {
  return <td className={cn("px-3", className)} data-slot="table-cell" {...props} />;
}

export { Table, TableBody, TableCell, TableHead, TableHeader, TableRow };
