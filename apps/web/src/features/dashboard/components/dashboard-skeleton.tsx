import { useTranslation } from "react-i18next";
import { Skeleton } from "@/components/ui/skeleton";

/** A white panel with the title and subtitle bars of the Figma "Cargando" and a block for its body. */
function PanelSkeleton({ bodyClassName }: { bodyClassName: string }) {
  return (
    <div className="flex flex-col gap-3 rounded-xl bg-(--color-surface-card) p-5">
      <Skeleton className="h-4 w-28" />
      <Skeleton className="h-3 w-44" />
      <Skeleton className={bodyClassName} />
    </div>
  );
}

/**
 * The Figma "Inicio · Cargando": the panels as blocks, announced once. It holds the place of the
 * panels the dashboard has so far, so the page does not change shape when the overview arrives.
 */
export function DashboardSkeleton() {
  const { t } = useTranslation();

  return (
    <div
      aria-label={t("dashboard.loading")}
      className="grid gap-4 desktop:grid-cols-2 desktop:gap-6"
      role="status"
    >
      <PanelSkeleton bodyClassName="h-64 w-full" />
      <PanelSkeleton bodyClassName="h-64 w-full" />
      <div className="desktop:col-span-2">
        <PanelSkeleton bodyClassName="h-72 w-full" />
      </div>
    </div>
  );
}
