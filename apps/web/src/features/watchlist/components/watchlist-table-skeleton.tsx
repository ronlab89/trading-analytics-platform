import { useTranslation } from "react-i18next";
import { Skeleton } from "@/components/ui/skeleton";

const ROWS = 5;

/**
 * The Figma "Cargando" rows of the markets tables, announced once as a loading status. The label
 * says what is loading: the watchlist unless the caller says otherwise.
 */
export function WatchlistTableSkeleton({ label }: { label?: string }) {
  const { t } = useTranslation();

  return (
    <div aria-label={label ?? t("markets.loading")} role="status">
      {Array.from({ length: ROWS }, (_, row) => (
        <div
          className="flex h-12 items-center gap-3 border-b border-(--color-border-default) px-3"
          key={row}
        >
          <Skeleton className="size-10" />
          <Skeleton className="h-3 w-32" />
          <Skeleton className="ml-auto h-3 w-16" />
          <Skeleton className="h-3 w-16" />
        </div>
      ))}
    </div>
  );
}
