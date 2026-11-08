import { useTranslation } from "react-i18next";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { useAlertDialogForAsset } from "@/features/alerts/hooks/use-alert-dialog-for-asset";
import { PortfoliosEmptyState } from "@/features/portfolios/components/portfolios-empty-state";
import { useIsMobile } from "@/hooks/use-media-query";
import { useRemoveWithUndo } from "../hooks/use-remove-with-undo";
import { useWatchlistRows } from "../hooks/use-watchlist-rows";
import { WatchlistCardsSkeleton } from "./watchlist-cards-skeleton";
import { WatchlistTableSkeleton } from "./watchlist-table-skeleton";
import { WatchlistView } from "./watchlist-view";

/**
 * The Watchlist tab of Markets with the Figma states: loading, the list, empty and failed. A
 * failed request is an alert with a retry, as on the other views. On the tablet and the desktop
 * everything sits in one card; on a phone the search is outside the card and the card is the list.
 */
export function WatchlistSection() {
  const { t } = useTranslation();
  const isMobile = useIsMobile();
  const { rows, isError, refetch } = useWatchlistRows();
  const removeWithUndo = useRemoveWithUndo();
  const alertDialog = useAlertDialogForAsset();

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
            {t("markets.failed.retry")}
          </Button>
        }
        description={t("markets.failed.description")}
        title={t("markets.failed.title")}
        tone="error"
      />
    );
  }

  const empty = (
    <PortfoliosEmptyState
      description={t("markets.empty.description")}
      title={t("markets.empty.title")}
    />
  );

  if (isMobile) {
    return rows === undefined ? (
      <WatchlistCardsSkeleton />
    ) : rows.length === 0 ? (
      <section className="rounded-xl bg-(--color-surface-card) p-6">{empty}</section>
    ) : (
      <div className="flex flex-col gap-4">
        <WatchlistView
          mobile
          onCreateAlert={alertDialog.openFor}
          onRemove={removeWithUndo}
          rows={rows}
        />
        {alertDialog.dialog}
      </div>
    );
  }

  return (
    <section className="flex flex-col gap-4 rounded-xl bg-(--color-surface-card) p-6">
      {rows === undefined ? (
        <WatchlistTableSkeleton />
      ) : rows.length === 0 ? (
        empty
      ) : (
        <WatchlistView onCreateAlert={alertDialog.openFor} onRemove={removeWithUndo} rows={rows} />
      )}
      {alertDialog.dialog}
    </section>
  );
}
