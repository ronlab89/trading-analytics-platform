import { useTranslation } from "react-i18next";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * The Figma "Cargando" of a decision's detail: grey blocks where the indicators and the panels go,
 * announced once as a loading status.
 */
export function DecisionDetailSkeleton() {
  const { t } = useTranslation();

  return (
    <div
      aria-label={t("decisions.detail.loading")}
      className="flex flex-col gap-4 desktop:gap-6"
      role="status"
    >
      <Skeleton className="h-5 w-40" />
      <div className="grid grid-cols-2 gap-4 desktop:grid-cols-4 desktop:gap-6">
        {Array.from({ length: 4 }, (_, index) => (
          <Skeleton className="h-28 w-full" key={index} />
        ))}
      </div>
      <div className="grid gap-4 desktop:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] desktop:gap-6">
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    </div>
  );
}
