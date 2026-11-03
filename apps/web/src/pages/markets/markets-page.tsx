import { useTranslation } from "react-i18next";
import { useWatchlistRows } from "@/features/watchlist/hooks/use-watchlist-rows";
import { useIsMobile } from "@/hooks/use-media-query";

/**
 * The Markets view (Figma, "Mercados"). On the desktop the header line counts the watched assets;
 * on a phone the title shows instead, as on the other views.
 */
export function MarketsPage() {
  const { t } = useTranslation();
  const isMobile = useIsMobile();
  const { rows } = useWatchlistRows();

  return (
    <div className="flex flex-col gap-4 desktop:gap-6">
      {isMobile ? (
        <h1 className="text-2xl leading-8 font-semibold text-(--color-text-default)">
          {t("nav.markets")}
        </h1>
      ) : (
        <>
          <h1 className="sr-only">{t("nav.markets")}</h1>
          {rows === undefined ? null : (
            <p className="text-sm text-(--color-text-secondary)">
              {t("markets.watchlistSummary", { count: rows.length })}
            </p>
          )}
        </>
      )}
    </div>
  );
}
