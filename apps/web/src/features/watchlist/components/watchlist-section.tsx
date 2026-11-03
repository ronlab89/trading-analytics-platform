import { useTranslation } from "react-i18next";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { PortfoliosEmptyState } from "@/features/portfolios/components/portfolios-empty-state";
import { useRemoveWithUndo } from "../hooks/use-remove-with-undo";
import { useWatchlistRows } from "../hooks/use-watchlist-rows";
import { WatchlistTable } from "./watchlist-table";
import { WatchlistTableSkeleton } from "./watchlist-table-skeleton";

/**
 * The Watchlist tab of Markets with the Figma states: loading, the table, empty and failed. A
 * failed request is an alert with a retry, as on the other views.
 */
export function WatchlistSection() {
  const { t } = useTranslation();
  const { rows, isError, refetch } = useWatchlistRows();
  const removeWithUndo = useRemoveWithUndo();

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

  return (
    <section className="flex flex-col gap-4 rounded-xl bg-(--color-surface-card) p-6">
      {rows === undefined ? (
        <WatchlistTableSkeleton />
      ) : rows.length === 0 ? (
        <PortfoliosEmptyState
          description={t("markets.empty.description")}
          title={t("markets.empty.title")}
        />
      ) : (
        <WatchlistTable onRemove={removeWithUndo} rows={rows} />
      )}
    </section>
  );
}
