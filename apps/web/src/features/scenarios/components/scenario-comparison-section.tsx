import type { ScenarioComparisonResponse } from "@trading/contracts";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { compareView } from "../lib/scenario-comparison";
import type { ScenarioMainChange } from "../types";
import { ComparisonCard } from "./comparison-card";
import { ComparisonDifferences } from "./comparison-differences";

interface ScenarioComparisonSectionProps {
  /** The answer of the API; undefined until it arrives, and for good if the request failed. */
  comparison: ScenarioComparisonResponse | undefined;
  isError: boolean;
  onRetry: () => void;
  /** The main variable of each scenario, from the list: the answer does not carry it. */
  mainChanges: ReadonlyMap<string, ScenarioMainChange | null>;
  portfolioName: string;
}

/**
 * What the comparison screen shows under its header: a card for the base and for each scenario, the
 * table of differences, and a notice for a scenario with changes the portfolio cannot take. While the
 * request is on its way blocks hold the place of the cards and the table, as the Figma "Cargando"
 * draws them; when it failed one alert says so, with a retry.
 */
export function ScenarioComparisonSection({
  comparison,
  isError,
  onRetry,
  mainChanges,
  portfolioName,
}: ScenarioComparisonSectionProps) {
  const { t } = useTranslation();
  const view = useMemo(
    () => (comparison === undefined ? undefined : compareView(comparison, mainChanges)),
    [comparison, mainChanges],
  );

  if (isError) {
    return (
      <Alert
        action={
          <Button onClick={onRetry} size="sm" variant="outline">
            {t("scenarios.compare.failed.retry")}
          </Button>
        }
        description={t("scenarios.compare.failed.description")}
        title={t("scenarios.compare.failed.title")}
        tone="error"
      />
    );
  }

  if (view === undefined) {
    return (
      <div
        aria-label={t("scenarios.compare.comparing")}
        className="flex flex-col gap-4 desktop:gap-6"
        role="status"
      >
        <div className="grid gap-4 desktop:grid-cols-3 desktop:gap-6">
          {Array.from({ length: 3 }, (_, index) => (
            <Skeleton className="h-36 w-full" key={index} />
          ))}
        </div>
        <Skeleton className="h-80 w-full" />
      </div>
    );
  }

  const withUnmatched = view.columns.filter((column) => column.unmatchedAssetIds.length > 0);

  return (
    <div className="flex flex-col gap-4 desktop:gap-6">
      <div className="grid gap-4 desktop:grid-cols-3 desktop:gap-6">
        {view.columns.map((column) => (
          <ComparisonCard column={column} key={column.id} portfolioName={portfolioName} />
        ))}
      </div>
      {withUnmatched.map((column) => (
        <Alert
          description={t("scenarios.compare.unmatched", { name: column.name ?? "" })}
          key={column.id}
          title={t("scenarios.compare.unmatchedTitle")}
          tone="info"
        />
      ))}
      <ComparisonDifferences view={view} />
    </div>
  );
}
