import { useTranslation } from "react-i18next";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { PortfoliosEmptyState } from "@/features/portfolios/components/portfolios-empty-state";
import { WatchlistCardsSkeleton } from "@/features/watchlist/components/watchlist-cards-skeleton";
import { WatchlistTableSkeleton } from "@/features/watchlist/components/watchlist-table-skeleton";
import { useIsMobile } from "@/hooks/use-media-query";
import type { DecisionRow } from "../types";
import { DecisionsView } from "./decisions-view";

interface DecisionsSectionProps {
  /** Undefined while the decisions (and the assets behind them) are loading. */
  rows: readonly DecisionRow[] | undefined;
  isError: boolean;
  onRetry: () => void;
  /** The empty state offers a first transaction: that is where a decision starts. */
  onNew: () => void;
}

/**
 * The decisions list with the Figma states: loading, the list, empty and failed. A failed request
 * is an alert with a retry, as on the other views. On the tablet and the desktop everything sits in
 * one card; on a phone the search is outside the card and the card is the list.
 */
export function DecisionsSection({ rows, isError, onRetry, onNew }: DecisionsSectionProps) {
  const { t } = useTranslation();
  const isMobile = useIsMobile();

  if (isError) {
    return (
      <Alert
        action={
          <Button onClick={onRetry} size="sm" variant="outline">
            {t("decisions.failed.retry")}
          </Button>
        }
        description={t("decisions.failed.description")}
        title={t("decisions.failed.title")}
        tone="error"
      />
    );
  }

  const empty = (
    <PortfoliosEmptyState
      action={
        <Button onClick={onNew} size="sm" variant="outline">
          {t("decisions.empty.action")}
        </Button>
      }
      description={t("decisions.empty.description")}
      title={t("decisions.empty.title")}
    />
  );

  if (isMobile) {
    return rows === undefined ? (
      <WatchlistCardsSkeleton label={t("decisions.loading")} />
    ) : rows.length === 0 ? (
      <section className="rounded-xl bg-(--color-surface-card) p-6">{empty}</section>
    ) : (
      <div className="flex flex-col gap-4">
        <DecisionsView mobile rows={rows} />
      </div>
    );
  }

  return (
    <section className="flex flex-col gap-4 rounded-xl bg-(--color-surface-card) p-6">
      {rows === undefined ? (
        <WatchlistTableSkeleton label={t("decisions.loading")} />
      ) : rows.length === 0 ? (
        empty
      ) : (
        <DecisionsView rows={rows} />
      )}
    </section>
  );
}
