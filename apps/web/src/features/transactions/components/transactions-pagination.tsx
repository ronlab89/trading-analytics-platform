import type { PaginationMeta } from "@trading/contracts";
import { ChevronLeft, ChevronRight, Ellipsis } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { pageWindow } from "../lib/page-window";

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
 * many, the rows per page and the pages. Below the desktop width the pages are written as "Page 1
 * of 5" between the two buttons, in two rows; on the desktop they are numbered buttons in a single
 * row. The server pages the list, so this reads the server's count instead of a table instance, and
 * the page and the size are the view's to keep. With no transactions it draws nothing, because the
 * view says why there are none.
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
    <div className="flex flex-col gap-3 text-sm text-(--color-text-secondary) desktop:flex-row desktop:items-center">
      <div className="flex items-center justify-between desktop:contents">
        <p className="desktop:mr-auto">{t("dataTable.showing", { from, to, total: meta.total })}</p>
        <div className="flex items-center gap-2 desktop:mr-6">
          <span aria-hidden="true">{t("transactions.pagination.rowsPerPage")}</span>
          <Select
            onValueChange={(value) => {
              onPageSizeChange(Number(value));
            }}
            value={String(meta.pageSize)}
          >
            <SelectTrigger
              aria-label={t("transactions.pagination.rowsPerPage")}
              className="w-auto border-transparent bg-transparent font-medium text-(--color-button-ghost-foreground)"
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
      </div>
      <nav
        aria-label={t("dataTable.pagination")}
        className="flex items-center justify-between desktop:gap-1"
      >
        <Button
          disabled={meta.page <= 1}
          onClick={() => {
            onPageChange(meta.page - 1);
          }}
          size="sm"
          variant="ghost"
        >
          <ChevronLeft aria-hidden="true" />
          {t("transactions.pagination.previous")}
        </Button>
        <p className="desktop:hidden">
          {t("dataTable.page", { page: meta.page, pageCount: meta.totalPages })}
        </p>
        <ul className="flex items-center gap-1 max-desktop:hidden">
          {pageWindow(meta.page, meta.totalPages).map((item, index) => (
            <li key={item === "ellipsis" ? `ellipsis-${String(index)}` : item}>
              {item === "ellipsis" ? (
                <Ellipsis aria-hidden="true" className="mx-2 size-4" />
              ) : (
                <Button
                  aria-current={item === meta.page ? "page" : undefined}
                  aria-label={t("transactions.pagination.goToPage", { page: item })}
                  onClick={() => {
                    onPageChange(item);
                  }}
                  size="icon-sm"
                  variant={item === meta.page ? "primary" : "ghost"}
                >
                  {item}
                </Button>
              )}
            </li>
          ))}
        </ul>
        <Button
          disabled={meta.page >= meta.totalPages}
          onClick={() => {
            onPageChange(meta.page + 1);
          }}
          size="sm"
          variant="ghost"
        >
          {t("transactions.pagination.next")}
          <ChevronRight aria-hidden="true" />
        </Button>
      </nav>
    </div>
  );
}
