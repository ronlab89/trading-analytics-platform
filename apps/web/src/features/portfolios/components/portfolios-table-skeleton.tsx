import { useTranslation } from "react-i18next";
import { Skeleton } from "@/components/ui/skeleton";

const ROWS = 4;

/** The Figma "Cargando" rows: one placeholder per column, announced once as a loading status. */
export function PortfoliosTableSkeleton() {
  const { t } = useTranslation();

  return (
    <div aria-label={t("portfolios.loading")} role="status">
      {Array.from({ length: ROWS }, (_, row) => (
        <div
          className="flex h-12 items-center gap-3 border-b border-(--color-border-default) px-3"
          key={row}
        >
          <Skeleton className="size-8" />
          <Skeleton className="h-3 w-28" />
          <Skeleton className="ml-auto h-3 w-16" />
          <Skeleton className="h-3 w-16" />
        </div>
      ))}
    </div>
  );
}
