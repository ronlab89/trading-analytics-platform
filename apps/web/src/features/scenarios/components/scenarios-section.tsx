import { useTranslation } from "react-i18next";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { PortfoliosEmptyState } from "@/features/portfolios/components/portfolios-empty-state";
import { WatchlistCardsSkeleton } from "@/features/watchlist/components/watchlist-cards-skeleton";
import { WatchlistTableSkeleton } from "@/features/watchlist/components/watchlist-table-skeleton";
import { useIsMobile } from "@/hooks/use-media-query";
import type { ScenarioRow } from "../types";
import { ScenariosView } from "./scenarios-view";

interface ScenariosSectionProps {
  /** Undefined while the scenarios (and the assets behind them) are loading. */
  rows: readonly ScenarioRow[] | undefined;
  isError: boolean;
  onRetry: () => void;
  /** The empty state offers the first scenario. */
  onNew: () => void;
}

/**
 * The scenarios list with the Figma states: loading, the list, empty and failed. A failed request
 * is an alert with a retry, as on the other views. On the tablet and the desktop everything sits in
 * one card; on a phone the search is outside the card and the card is the list.
 */
export function ScenariosSection({ rows, isError, onRetry, onNew }: ScenariosSectionProps) {
  const { t } = useTranslation();
  const isMobile = useIsMobile();

  if (isError) {
    return (
      <Alert
        action={
          <Button onClick={onRetry} size="sm" variant="outline">
            {t("scenarios.failed.retry")}
          </Button>
        }
        description={t("scenarios.failed.description")}
        title={t("scenarios.failed.title")}
        tone="error"
      />
    );
  }

  const empty = (
    <PortfoliosEmptyState
      action={
        <Button onClick={onNew} size="sm" variant="outline">
          {t("scenarios.empty.action")}
        </Button>
      }
      description={t("scenarios.empty.description")}
      title={t("scenarios.empty.title")}
    />
  );

  if (isMobile) {
    return rows === undefined ? (
      <WatchlistCardsSkeleton label={t("scenarios.loading")} />
    ) : rows.length === 0 ? (
      <section className="rounded-xl bg-(--color-surface-card) p-6">{empty}</section>
    ) : (
      <div className="flex flex-col gap-4">
        <ScenariosView mobile rows={rows} />
      </div>
    );
  }

  return (
    <section className="flex flex-col gap-4 rounded-xl bg-(--color-surface-card) p-6">
      {rows === undefined ? (
        <WatchlistTableSkeleton label={t("scenarios.loading")} />
      ) : rows.length === 0 ? (
        empty
      ) : (
        <ScenariosView rows={rows} />
      )}
    </section>
  );
}
