import { useTranslation } from "react-i18next";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * The Figma "Cargando" of the editor: grey blocks where the two cards go, announced once as a
 * loading status.
 */
export function ScenarioEditorSkeleton() {
  const { t } = useTranslation();

  return (
    <div
      aria-label={t("scenarios.editor.loading")}
      className="flex flex-col gap-4 desktop:gap-6"
      role="status"
    >
      <Skeleton className="h-9 w-48" />
      <div className="grid gap-4 desktop:grid-cols-[minmax(0,408fr)_minmax(0,912fr)] desktop:gap-6">
        <Skeleton className="h-96 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    </div>
  );
}
