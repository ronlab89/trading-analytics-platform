import { useTranslation } from "react-i18next";
import { useSearchParams } from "react-router";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CatalogSummary } from "@/features/catalog/components/catalog-summary";
import { WatchlistSection } from "@/features/watchlist/components/watchlist-section";
import { WatchlistSummary } from "@/features/watchlist/components/watchlist-summary";
import { useIsMobile } from "@/hooks/use-media-query";

const TAB_PARAM = "tab";
type MarketsTab = "watchlist" | "all";

/** The tab is in the address (`?tab=all`), so a link can open the catalog and Back leaves it. */
function useMarketsTab(): [MarketsTab, (tab: MarketsTab) => void] {
  const [params, setParams] = useSearchParams();
  const tab: MarketsTab = params.get(TAB_PARAM) === "all" ? "all" : "watchlist";

  const select = (next: MarketsTab) => {
    setParams(next === "all" ? { [TAB_PARAM]: "all" } : {}, { replace: true });
  };

  return [tab, select];
}

/**
 * The Markets view (Figma, "Mercados"): the user's watchlist and the catalog of every asset, in two
 * tabs. On the tablet and the desktop a header line (how many assets) sits at the left of the
 * tabs; on a phone the title shows instead, with the tabs under it, as on the other views.
 */
export function MarketsPage() {
  const { t } = useTranslation();
  const isMobile = useIsMobile();
  const [tab, selectTab] = useMarketsTab();

  const tabs = (
    <TabsList aria-label={t("markets.tabsLabel")} className={isMobile ? "w-full" : undefined}>
      <TabsTrigger className={isMobile ? "flex-1" : undefined} value="watchlist">
        {t("markets.tabs.watchlist")}
      </TabsTrigger>
      <TabsTrigger className={isMobile ? "flex-1" : undefined} value="all">
        {t("markets.tabs.all")}
      </TabsTrigger>
    </TabsList>
  );

  return (
    <Tabs
      className="flex flex-col gap-4 desktop:gap-6"
      onValueChange={(value) => {
        selectTab(value === "all" ? "all" : "watchlist");
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
            {tab === "all" ? <CatalogSummary /> : <WatchlistSummary />}
            {tabs}
          </div>
        </>
      )}
      <TabsContent value="watchlist">
        <WatchlistSection />
      </TabsContent>
      <TabsContent value="all" />
    </Tabs>
  );
}
