import { LoaderCircle } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Logo } from "@/components/logo";

/**
 * What the app shows while the first refresh answers on a reload. The Figma has no frame for it,
 * so it is built from the pieces of "Entrando a la demo": the brand mark, the same spinner and the
 * secondary text, centered on the page background. `index.html` paints the same mark and spinner
 * before any script runs, so the page does not flash blank first: keep the two in step (sizes,
 * gaps and colors) when this changes.
 */
export function SessionRestoring() {
  const { t } = useTranslation();

  return (
    <div
      className="flex min-h-dvh flex-col items-center justify-center gap-6 bg-(--color-surface-page) p-6"
      role="status"
    >
      <Logo className="size-10" />
      <div className="flex flex-col items-center gap-3 text-(--color-text-secondary)">
        <LoaderCircle aria-hidden="true" className="size-5 animate-spin" />
        <p className="text-sm leading-5">{t("auth.restoringSession")}</p>
      </div>
    </div>
  );
}
