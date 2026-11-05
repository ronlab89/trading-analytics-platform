import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useSearchParams } from "react-router";
import { AlertsTab } from "@/features/alerts/components/alerts-tab";
import { AlertsSummary } from "@/features/alerts/components/alerts-summary";
import { ConnectionAlert } from "@/components/connection-alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CatalogSection } from "@/features/catalog/components/catalog-section";
import { CatalogSummary } from "@/features/catalog/components/catalog-summary";
import { WatchlistSection } from "@/features/watchlist/components/watchlist-section";
import { WatchlistSummary } from "@/features/watchlist/components/watchlist-summary";
import { NO_CATALOG_FILTERS, type CatalogFilters } from "@/features/catalog/lib/catalog-filters";
import { useIsMobile } from "@/hooks/use-media-query";

const TAB_PARAM = "tab";
type MarketsTab = "watchlist" | "all" | "alerts";
const TABS: readonly MarketsTab[] = ["watchlist", "all", "alerts"];

/** The tab is in the address (`?tab=all`, `?tab=alerts`), so a link can open the catalog and Back leaves it. */
function useMarketsTab(): [MarketsTab, (tab: MarketsTab) => void] {
  const [params, setParams] = useSearchParams();
  const tab: MarketsTab = TABS.find((name) => name === params.get(TAB_PARAM)) ?? "watchlist";

  const select = (next: MarketsTab) => {
    setParams(next === "watchlist" ? {} : { [TAB_PARAM]: next }, { replace: true });
  };

  return [tab, select];
}

/**
 * The Markets view (Figma, "Mercados"): the user's watchlist and the catalog of every asset, in two
 * tabs. On the tablet and the desktop a header line (how many assets) sits at the left of the
 * tabs; on a phone the title shows instead, with the tabs under it, as on the other views. Both
 * tabs show live prices, so one connection alert sits above them when the prices are paused.
 */
export function MarketsPage() {
  const { t } = useTranslation();
  const isMobile = useIsMobile();
  const [tab, selectTab] = useMarketsTab();
  // The catalog filters live here, as the header line counts what they leave.
  const [catalogFilters, setCatalogFilters] = useState<CatalogFilters>(NO_CATALOG_FILTERS);

  const tabs = (
    <TabsList aria-label={t("markets.tabsLabel")} className={isMobile ? "w-full" : undefined}>
      <TabsTrigger className={isMobile ? "flex-1" : undefined} value="watchlist">
        {t("markets.tabs.watchlist")}
      </TabsTrigger>
      <TabsTrigger className={isMobile ? "flex-1" : undefined} value="all">
        {t("markets.tabs.all")}
      </TabsTrigger>
      <TabsTrigger className={isMobile ? "flex-1" : undefined} value="alerts">
        {t("markets.tabs.alerts")}
      </TabsTrigger>
    </TabsList>
  );

  return (
    <Tabs
      className="flex flex-col gap-4 desktop:gap-6"
      onValueChange={(value) => {
        selectTab(TABS.find((name) => name === value) ?? "watchlist");
      }}
      value={tab}
    >
      {isMobile ? (
        <>
          <h1 className="text-2xl leading-8 font-semibold text-(--color-text-default)">
            {t("nav.markets")}
          </h1>
          {tabs}
        </>
      ) : (
        <>
          <h1 className="sr-only">{t("nav.markets")}</h1>
          <div className="flex items-center justify-between gap-4">
            {tab === "all" ? (
              <CatalogSummary filters={catalogFilters} />
            ) : tab === "alerts" ? (
              <AlertsSummary />
            ) : (
              <WatchlistSummary />
            )}
            {tabs}
          </div>
        </>
      )}
      <ConnectionAlert />
      <TabsContent value="watchlist">
        <WatchlistSection />
      </TabsContent>
      <TabsContent value="all">
        <CatalogSection filters={catalogFilters} onFiltersChange={setCatalogFilters} />
      </TabsContent>
      <TabsContent value="alerts">
        <AlertsTab />
      </TabsContent>
    </Tabs>
  );
}
