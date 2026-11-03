import { useTranslation } from "react-i18next";
import { useWatchlistRows } from "../hooks/use-watchlist-rows";

/** The header line of the Watchlist tab: how many assets the user watches. It waits for the list. */
export function WatchlistSummary() {
  const { t } = useTranslation();
  const { rows } = useWatchlistRows();

  if (rows === undefined) return null;
  return (
    <p className="text-sm text-(--color-text-secondary)">
      {t("markets.watchlistSummary", { count: rows.length })}
    </p>
  );
}
