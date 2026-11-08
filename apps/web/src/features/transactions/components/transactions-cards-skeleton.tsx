import { useTranslation } from "react-i18next";
import { Skeleton } from "@/components/ui/skeleton";

const ROWS = 6;

/**
 * The Figma mobile "Cargando" list of the transactions: the same white card with its rows, each
 * with the avatar, two lines at the left and two at the right, announced once.
 */
export function TransactionsCardsSkeleton() {
  const { t } = useTranslation();

  return (
    <div
      aria-label={t("transactions.loading")}
      className="flex flex-col overflow-hidden rounded-xl bg-(--color-surface-card)"
      role="status"
    >
      {Array.from({ length: ROWS }, (_, row) => (
        <div
          className="flex items-center gap-3 border-b border-(--color-border-default) px-4 py-3 last:border-b-0"
          key={row}
        >
          <Skeleton className="size-10 rounded-md" />
          <div className="flex flex-1 flex-col gap-2">
            <Skeleton className="h-3 w-30" />
            <Skeleton className="h-2.5 w-20" />
          </div>
          <div className="flex flex-col items-end gap-2">
            <Skeleton className="h-3 w-18" />
            <Skeleton className="h-2.5 w-14" />
          </div>
        </div>
      ))}
    </div>
  );
}
