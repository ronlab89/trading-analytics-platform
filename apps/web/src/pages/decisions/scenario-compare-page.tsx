import { RotateCcw } from "lucide-react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Navigate, useNavigate, useSearchParams } from "react-router";
import { ApiError } from "@/api/trading-client";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { PortfoliosEmptyState } from "@/features/portfolios/components/portfolios-empty-state";
import { CompareScenariosDialog } from "@/features/scenarios/components/compare-scenarios-dialog";
import {
  BackToScenarios,
  SCENARIOS_PATH,
} from "@/features/scenarios/components/scenario-editor-header";
import { ScenarioComparisonSection } from "@/features/scenarios/components/scenario-comparison-section";
import { useScenarioComparison } from "@/features/scenarios/hooks/use-scenario-comparison";
import { useScenarioMainChanges } from "@/features/scenarios/hooks/use-scenario-main-changes";
import { compareScenariosPath, parseComparedIds } from "@/features/scenarios/lib/compare-path";
import { useActivePortfolio } from "@/hooks/use-active-portfolio";
import { useIsMobile } from "@/hooks/use-media-query";
import { NotFoundPage } from "@/pages/not-found/not-found-page";

/**
 * The comparison of two to five scenarios of the active portfolio, which the address names
 * (`?ids=s1,s2`, in the order of their letters) so it can be shared and Back works. An address
 * without a valid set goes back to the Scenario Lab with nothing compared. The portfolio is the
 * `key` of the content, as in the editor, so choosing another one never shows the previous one's.
 */
export function ScenarioComparePage() {
  const { t } = useTranslation();
  const [params] = useSearchParams();
  const raw = params.get("ids");
  const scenarioIds = useMemo(() => parseComparedIds(raw), [raw]);
  const { active, isPending, isError, retry } = useActivePortfolio();

  if (scenarioIds === null) {
    return <Navigate replace to={SCENARIOS_PATH} />;
  }

  return active !== undefined ? (
    <Comparing
      key={active.id}
      portfolioId={active.id}
      portfolioName={active.name}
      scenarioIds={scenarioIds}
    />
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

interface ComparingProps {
  portfolioId: string;
  portfolioName: string;
  scenarioIds: string[];
}

function Comparing({ portfolioId, portfolioName, scenarioIds }: ComparingProps) {
  const { t } = useTranslation();
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const [picking, setPicking] = useState(false);
  const comparison = useScenarioComparison(portfolioId, scenarioIds);
  const mainChanges = useScenarioMainChanges(portfolioId, scenarioIds);

  if (comparison.error instanceof ApiError && comparison.error.status === 404) {
    return <NotFoundPage />;
  }

  return (
    <div className="flex flex-col gap-4 desktop:gap-6">
      <h1
        className={
          isMobile ? "text-2xl leading-8 font-semibold text-(--color-text-default)" : "sr-only"
        }
      >
        {t("scenarios.compare.title")}
      </h1>
      <div className="flex flex-col gap-3 desktop:flex-row desktop:items-center desktop:justify-between">
        <BackToScenarios />
        <Button
          className="self-start"
          disabled={comparison.isPending}
          onClick={() => {
            setPicking(true);
          }}
          variant="outline"
        >
          <RotateCcw aria-hidden="true" />
          {t("scenarios.compare.change")}
        </Button>
      </div>
      <ScenarioComparisonSection
        comparison={comparison.data}
        isError={comparison.isError}
        mainChanges={mainChanges}
        onRetry={() => {
          void comparison.refetch();
        }}
        portfolioName={portfolioName}
      />
      <CompareScenariosDialog
        onConfirm={(ids) => {
          setPicking(false);
          void navigate(compareScenariosPath(ids));
        }}
        onOpenChange={setPicking}
        open={picking}
        portfolioId={portfolioId}
        selected={scenarioIds}
      />
    </div>
  );
}
