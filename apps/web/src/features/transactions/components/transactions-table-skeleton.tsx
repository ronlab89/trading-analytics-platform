import { useTranslation } from "react-i18next";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

const ROWS = 10;

/** The tablet drops these three columns, so their placeholders go with them. */
const DESKTOP_ONLY = "max-desktop:hidden";

/**
 * The columns of the table in the order the Figma draws them, each with the width of its
 * placeholder. The headers stay while the rows load, as the Figma "Cargando" shows, so the table
 * does not change shape when the data arrives.
 */
const columns = [
  { key: "date", width: "w-[70px]" },
  { key: "type", width: "w-[60px]" },
  { key: "asset", width: "w-[110px]", avatar: true },
  { key: "quantity", width: "w-10", end: true, desktopOnly: true },
  { key: "price", width: "w-14", end: true, desktopOnly: true },
  { key: "fees", width: "w-11", end: true, desktopOnly: true },
  { key: "total", width: "w-[60px]", end: true },
  { key: "status", width: "w-[70px]" },
] as const;

type SkeletonColumn = (typeof columns)[number];

function alignment(column: SkeletonColumn) {
  return "end" in column ? "text-right" : "text-left";
}

/** The Figma "Cargando" rows of the transactions table on the tablet and the desktop, announced once. */
export function TransactionsTableSkeleton() {
  const { t } = useTranslation();

  return (
    <div aria-label={t("transactions.loading")} role="status">
      <Table aria-hidden="true">
        <TableHeader>
          <TableRow className="h-auto">
            {columns.map((column: SkeletonColumn) => (
              <TableHead
                className={cn(alignment(column), "desktopOnly" in column && DESKTOP_ONLY)}
                key={column.key}
              >
                {t(`transactions.columns.${column.key}`)}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {Array.from({ length: ROWS }, (_, row) => (
            <TableRow key={row}>
              {columns.map((column: SkeletonColumn) => (
                <TableCell
                  className={cn(alignment(column), "desktopOnly" in column && DESKTOP_ONLY)}
                  key={column.key}
                >
                  <span
                    className={cn(
                      "inline-flex items-center gap-3",
                      "end" in column && "justify-end",
                    )}
                  >
                    {"avatar" in column ? <Skeleton className="size-8" /> : null}
                    <Skeleton className={cn("h-3", column.width)} />
                  </span>
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
