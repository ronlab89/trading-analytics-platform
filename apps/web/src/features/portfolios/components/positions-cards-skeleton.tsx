import { useTranslation } from "react-i18next";
import { Skeleton } from "@/components/ui/skeleton";

const CARDS = 3;

/** The Figma mobile "Cargando" cards of the positions: avatar and name, then two lines, announced once. */
export function PositionsCardsSkeleton() {
  const { t } = useTranslation();

  return (
    <div
      aria-label={t("portfolioDetail.positions.loading")}
      className="flex flex-col gap-3"
      role="status"
    >
      {Array.from({ length: CARDS }, (_, card) => (
        <div className="flex flex-col gap-3 rounded-xl bg-(--color-surface-card) p-4" key={card}>
          <div className="flex items-center gap-3">
            <Skeleton className="size-10 rounded-md" />
            <Skeleton className="h-3 flex-1" />
          </div>
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-24" />
        </div>
      ))}
    </div>
  );
}
