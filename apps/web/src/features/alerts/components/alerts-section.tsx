import { Plus } from "lucide-react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { PortfoliosEmptyState } from "@/features/portfolios/components/portfolios-empty-state";
import { WatchlistCardsSkeleton } from "@/features/watchlist/components/watchlist-cards-skeleton";
import { WatchlistTableSkeleton } from "@/features/watchlist/components/watchlist-table-skeleton";
import { useIsMobile } from "@/hooks/use-media-query";
import { useAlertRows } from "../hooks/use-alert-rows";
import type { AlertRow } from "../lib/alert-row";
import { AlertsView } from "./alerts-view";

/**
 * The Alerts tab of Markets with its states: loading, the list, empty and failed. A failed request
 * is an alert with a retry, as on the other tabs. On the tablet and the desktop everything sits in
 * one card; on a phone the search is outside the card and the card is the list. `onCreate` opens
 * the creation of an alert and `renderAction` draws the menu of each row.
 */
export function AlertsSection({
  onCreate,
  renderAction,
}: {
  onCreate?: (() => void) | undefined;
  renderAction?: ((row: AlertRow) => ReactNode) | undefined;
}) {
  const { t } = useTranslation();
  const isMobile = useIsMobile();
  const { rows, isError, refetch } = useAlertRows();

  if (isError) {
    return (
      <Alert
        action={
          <Button
            onClick={() => {
              void refetch();
            }}
            size="sm"
            variant="outline"
          >
            {t("alerts.failed.retry")}
          </Button>
        }
        description={t("alerts.failed.description")}
        title={t("alerts.failed.title")}
        tone="error"
      />
    );
  }

  const empty = (
    <PortfoliosEmptyState
      action={
        onCreate === undefined ? undefined : (
          <Button onClick={onCreate} size="sm">
            <Plus aria-hidden="true" className="size-4" />
            {t("alerts.create")}
          </Button>
        )
      }
      description={t("alerts.empty.description")}
      title={t("alerts.empty.title")}
    />
  );
  const loading = t("alerts.loading");

  if (isMobile) {
    return rows === undefined ? (
      <WatchlistCardsSkeleton label={loading} />
    ) : rows.length === 0 ? (
      <section className="rounded-xl bg-(--color-surface-card) p-6">{empty}</section>
    ) : (
      <div className="flex flex-col gap-4">
        <AlertsView mobile onCreate={onCreate} renderAction={renderAction} rows={rows} />
      </div>
    );
  }

  return (
    <section className="flex flex-col gap-4 rounded-xl bg-(--color-surface-card) p-6">
      {rows === undefined ? (
        <WatchlistTableSkeleton label={loading} />
      ) : rows.length === 0 ? (
        empty
      ) : (
        <AlertsView onCreate={onCreate} renderAction={renderAction} rows={rows} />
      )}
    </section>
  );
}
