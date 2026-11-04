import { useTranslation } from "react-i18next";
import { useParams } from "react-router";
import { ApiError } from "@/api/trading-client";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { PortfoliosEmptyState } from "@/features/portfolios/components/portfolios-empty-state";
import { ScenarioEditor } from "@/features/scenarios/components/scenario-editor";
import { useScenario } from "@/features/scenarios/hooks/use-scenario";
import { useActivePortfolio } from "@/hooks/use-active-portfolio";
import { useIsMobile } from "@/hooks/use-media-query";
import { NotFoundPage } from "@/pages/not-found/not-found-page";

/**
 * One scenario of the Scenario Lab in the active portfolio. The portfolio is the `key` of the
 * content, as in the Decision Center, so choosing another one never shows the scenario of the
 * previous one. A scenario that does not exist gets the global not-found page.
 */
export function ScenarioEditorPage() {
  const { t } = useTranslation();
  const { scenarioId = "" } = useParams();
  const { active, isPending, isError, retry } = useActivePortfolio();

  return active !== undefined ? (
    <Editing key={active.id} portfolioId={active.id} scenarioId={scenarioId} />
  ) : (
    <div className="flex flex-col gap-4 desktop:gap-6">
      {isError ? (
        <Alert
          action={
            <Button onClick={retry} size="sm" variant="outline">
              {t("decisions.failed.retry")}
            </Button>
          }
          description={t("decisions.failed.description")}
          title={t("decisions.failed.title")}
          tone="error"
        />
      ) : isPending ? null : (
        <section className="rounded-xl bg-(--color-surface-card) p-6">
          <PortfoliosEmptyState
            description={t("portfolios.empty.description")}
            title={t("portfolios.empty.title")}
          />
        </section>
      )}
    </div>
  );
}

function Editing({ portfolioId, scenarioId }: { portfolioId: string; scenarioId: string }) {
  const { t } = useTranslation();
  const isMobile = useIsMobile();
  // The same query the editor reads, so the page names itself from it without asking twice.
  const scenario = useScenario(portfolioId, scenarioId);

  if (scenario.error instanceof ApiError && scenario.error.status === 404) {
    return <NotFoundPage />;
  }

  return (
    <div className="flex flex-col gap-4 desktop:gap-6">
      <h1
        className={
          isMobile ? "text-2xl leading-8 font-semibold text-(--color-text-default)" : "sr-only"
        }
      >
        {scenario.data?.name ?? t("nav.decisions")}
      </h1>
      <ScenarioEditor portfolioId={portfolioId} scenarioId={scenarioId} />
    </div>
  );
}
