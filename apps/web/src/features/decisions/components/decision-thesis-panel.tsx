import type { DecisionResponse } from "@trading/contracts";
import { useTranslation } from "react-i18next";
import { AnalyticsPanel } from "@/features/analytics/components/analytics-panel";

/**
 * The Figma "Tesis y contexto": what was thought when the decision was made, in the words the
 * decision has: its thesis and its notes. The market context of the Figma has no field in the API,
 * so it is left out.
 */
export function DecisionThesisPanel({ decision }: { decision: DecisionResponse }) {
  const { t } = useTranslation();

  return (
    <AnalyticsPanel
      subtitle={t("decisions.detail.thesis.subtitle")}
      title={t("decisions.detail.thesis.title")}
    >
      <div className="flex flex-col gap-4">
        <section className="flex flex-col gap-1">
          <h3 className="text-base font-medium text-(--color-text-default)">
            {t("decisions.detail.thesis.thesis")}
          </h3>
          <p className="text-sm leading-6 text-(--color-text-secondary)">{decision.thesis}</p>
        </section>
        <section className="flex flex-col gap-1">
          <h3 className="text-base font-medium text-(--color-text-default)">
            {t("decisions.detail.thesis.notes")}
          </h3>
          <p className="text-sm leading-6 text-(--color-text-secondary)">
            {decision.notes ?? t("decisions.detail.thesis.noNotes")}
          </p>
        </section>
      </div>
    </AnalyticsPanel>
  );
}
