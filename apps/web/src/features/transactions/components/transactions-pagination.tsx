import type { PaginationMeta } from "@trading/contracts";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const PAGE_SIZES = [10, 20, 50] as const;

interface TransactionsPaginationProps {
  /** The server's answer for the page on screen: which page, how many per page and how many in all. */
  meta: PaginationMeta;
  /** How many rows the page on screen has, which the last page may have fewer than a full one. */
  shown: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
}

/**
 * The footer of the transactions table, as the Figma draws it: which rows are shown out of how
 * many, the rows per page and the page with its two buttons. The server pages the list, so this
 * reads the server's count instead of a table instance, and the page and the size are the view's to
 * keep. With no transactions it draws nothing, because the view says why there are none.
 */
export function TransactionsPagination({
  meta,
  shown,
  onPageChange,
  onPageSizeChange,
}: TransactionsPaginationProps) {
  const { t } = useTranslation();
  if (meta.total === 0) return null;

  const from = (meta.page - 1) * meta.pageSize + 1;
  const to = from + shown - 1;

  return (
    <div className="flex flex-wrap items-center justify-between gap-4 text-sm text-(--color-text-secondary)">
      <p>{t("dataTable.showing", { from, to, total: meta.total })}</p>
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <span aria-hidden="true">{t("transactions.pagination.rowsPerPage")}</span>
          <Select
            onValueChange={(value) => {
              onPageSizeChange(Number(value));
            }}
            value={String(meta.pageSize)}
          >
            <SelectTrigger
              aria-label={t("transactions.pagination.rowsPerPage")}
              className="w-20"
              size="sm"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PAGE_SIZES.map((size) => (
                <SelectItem key={size} value={String(size)}>
                  {size}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <nav aria-label={t("dataTable.pagination")} className="flex items-center gap-2">
          <p>{t("dataTable.page", { page: meta.page, pageCount: meta.totalPages })}</p>
          <Button
            aria-label={t("dataTable.previousPage")}
            disabled={meta.page <= 1}
            onClick={() => {
              onPageChange(meta.page - 1);
            }}
            size="icon-sm"
            variant="outline"
          >
            <ChevronLeft aria-hidden="true" />
          </Button>
          <Button
            aria-label={t("dataTable.nextPage")}
            disabled={meta.page >= meta.totalPages}
            onClick={() => {
              onPageChange(meta.page + 1);
            }}
            size="icon-sm"
            variant="outline"
          >
            <ChevronRight aria-hidden="true" />
          </Button>
        </nav>
      </div>
    </div>
  );
}
